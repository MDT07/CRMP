from __future__ import annotations

from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import get_settings
from app.models.email_account import EmailAccount
from app.models.email_provider import EmailProvider
from app.services.gmail_sync_service import GmailSyncService


class EmailSyncScheduler:
    """Background scheduler for automatic email syncing."""

    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.settings = get_settings()
        self._engine = None
        self._session_maker = None

    def _get_session(self) -> AsyncSession:
        """Create a new database session."""
        if self._engine is None:
            self._engine = create_async_engine(
                self.settings.database_url,
                echo=self.settings.sql_echo,
            )
            self._session_maker = sessionmaker(
                self._engine,
                class_=AsyncSession,
                expire_on_commit=False,
            )
        return self._session_maker()

    async def sync_all_accounts(self):
        """Sync all enabled email accounts."""
        session = self._get_session()

        try:
            # Get all accounts that need syncing
            from sqlalchemy import select

            # Accounts that haven't synced in 5 minutes
            cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=5)

            result = await session.execute(
                select(EmailAccount)
                .where(EmailAccount.sync_enabled == True)
                .where(
                    (EmailAccount.last_sync_at == None) | (EmailAccount.last_sync_at < cutoff_time)
                )
            )

            accounts = result.scalars().all()

            logger.error(f"[EmailSyncScheduler] Found {len(accounts)} accounts to sync")

            for account in accounts:
                try:
                    if account.provider == EmailProvider.gmail:
                        sync_service = GmailSyncService(session)
                        synced, errors = await sync_service.sync_account(account)
                        logger.info(
                            "[EmailSyncScheduler] Synced %s: %s messages, %s errors",
                            account.email_address,
                            synced,
                            errors,
                        )
                    else:
                        logger.info(
                            "[EmailSyncScheduler] Skipping %s: Provider %s not yet implemented",
                            account.email_address,
                            account.provider,
                        )
                except Exception as e:
                    logger.error("[EmailSyncScheduler] Error syncing %s: %s", account.email_address, e)
                    # Continue with next account even if one fails

        finally:
            await session.close()

    async def sync_account_by_id(self, account_id: str):
        """Sync a specific account by ID."""
        from uuid import UUID

        session = self._get_session()

        try:
            from sqlalchemy import select

            result = await session.execute(
                select(EmailAccount).where(EmailAccount.id == UUID(account_id))
            )
            account = result.scalar_one_or_none()

            if account and account.sync_enabled:
                if account.provider == EmailProvider.gmail:
                    sync_service = GmailSyncService(session)
                    synced, errors = await sync_service.sync_account(account)
                    logger.info(
                        "[EmailSyncScheduler] Synced %s: %s messages, %s errors",
                        account.email_address,
                        synced,
                        errors,
                    )
        finally:
            await session.close()

    def start(self):
        """Start the scheduler."""
        # Schedule sync every 5 minutes
        self.scheduler.add_job(
            self.sync_all_accounts,
            trigger=IntervalTrigger(minutes=5),
            id="email_sync_all",
            name="Sync all email accounts",
            replace_existing=True,
        )

        self.scheduler.start()
        logger.info("[EmailSyncScheduler] Started automatic email sync (every 5 minutes)")

    def shutdown(self):
        """Shutdown the scheduler."""
        self.scheduler.shutdown()
        logger.info("[EmailSyncScheduler] Shutdown")


# Global scheduler instance
_sync_scheduler: EmailSyncScheduler | None = None


def get_sync_scheduler() -> EmailSyncScheduler:
    """Get or create the global sync scheduler."""
    global _sync_scheduler
    if _sync_scheduler is None:
        _sync_scheduler = EmailSyncScheduler()
    return _sync_scheduler
