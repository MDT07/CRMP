from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.models.contact import Contact
from app.models.deal import Deal
from app.models.enums import (
    ContactStatus,
    DealStage,
    MessageChannel,
    MessageDirection,
    ProjectStatus,
    TaskSource,
    TaskStatus,
)
from app.models.message import Message
from app.models.organization import Organization
from app.models.project import Project
from app.models.task import Task
from app.models.user import User
from app.schemas.organization import (
    OrganizationRead,
    OrganizationUpdate,
    WorkspaceRead,
    WorkspaceStats,
)


class OrganizationService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_workspace(self, organization_id: UUID) -> WorkspaceRead:
        organization = await self._get_organization(organization_id)
        return await self._build_workspace_read(organization)

    async def update_organization(
        self,
        organization_id: UUID,
        payload: OrganizationUpdate,
    ) -> WorkspaceRead:
        organization = await self._get_organization(organization_id)
        updates = payload.model_dump(exclude_unset=True)

        slug = updates.get("slug")
        if slug is not None:
            normalized_slug = slug.strip().lower()
            if len(normalized_slug) < 2:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Organization slug must be at least 2 characters long.",
                )

            existing_org = await self.session.scalar(
                select(Organization)
                .where(func.lower(Organization.slug) == normalized_slug)
                .where(Organization.id != organization_id)
            )
            if existing_org is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="That organization slug is already in use.",
                )
            updates["slug"] = normalized_slug

        for field, value in updates.items():
            if isinstance(value, str):
                setattr(organization, field, value.strip())
            else:
                setattr(organization, field, value)

        await self.session.commit()
        await self.session.refresh(organization)
        return await self._build_workspace_read(organization)

    async def list_members(self, organization_id: UUID) -> list[User]:
        members = await self.session.scalars(
            select(User)
            .where(User.organization_id == organization_id)
            .order_by(User.created_at.asc())
        )
        return list(members.all())

    async def bootstrap_workspace(self, organization_id: UUID, actor: User) -> bool:
        organization = await self._get_organization(organization_id)
        stats = await self._get_workspace_stats(organization_id)
        if self._has_crm_data(stats):
            return False

        now = datetime.now(timezone.utc)

        northstar_company = Company(
            organization_id=organization_id,
            name="Northstar Commerce",
            industry="Retail technology",
            size="51-200",
            domain="northstarcommerce.com",
            extra_data={"segment": "Expansion"},
            created_at=now - timedelta(weeks=8),
            updated_at=now - timedelta(weeks=7, days=5),
        )
        atlas_company = Company(
            organization_id=organization_id,
            name="Atlas Logistics",
            industry="Logistics",
            size="201-500",
            domain="atlaslogistics.co",
            extra_data={"segment": "Operations"},
            created_at=now - timedelta(weeks=6, days=1),
            updated_at=now - timedelta(weeks=5),
        )
        luma_company = Company(
            organization_id=organization_id,
            name="Luma Studio",
            industry="Creative services",
            size="11-50",
            domain="lumastudio.io",
            extra_data={"segment": "Customer"},
            created_at=now - timedelta(weeks=4, days=2),
            updated_at=now - timedelta(weeks=3, days=4),
        )
        meridian_company = Company(
            organization_id=organization_id,
            name="Meridian Health",
            industry="Healthcare",
            size="501-1000",
            domain="meridianhealth.io",
            extra_data={"segment": "Enterprise"},
            created_at=now - timedelta(weeks=2, days=5),
            updated_at=now - timedelta(weeks=2, days=1),
        )
        self.session.add_all(
            [northstar_company, atlas_company, luma_company, meridian_company]
        )
        await self.session.flush()

        mia_contact = Contact(
            organization_id=organization_id,
            owner_user_id=actor.id,
            company_id=northstar_company.id,
            name="Mia Chen",
            email="mia@northstarcommerce.com",
            phone="+1-415-555-0110",
            status=ContactStatus.customer,
            lead_score=94,
            tags=["expansion", "priority"],
            extra_data={"title": "VP Growth"},
            created_at=now - timedelta(weeks=8, days=1),
            updated_at=now - timedelta(weeks=6, days=5),
        )
        omar_contact = Contact(
            organization_id=organization_id,
            owner_user_id=actor.id,
            company_id=atlas_company.id,
            name="Omar Haddad",
            email="omar@atlaslogistics.co",
            phone="+1-312-555-0145",
            status=ContactStatus.active,
            lead_score=78,
            tags=["operations", "pilot"],
            extra_data={"title": "Head of Dispatch"},
            created_at=now - timedelta(weeks=6),
            updated_at=now - timedelta(weeks=4, days=3),
        )
        sofia_contact = Contact(
            organization_id=organization_id,
            owner_user_id=actor.id,
            company_id=luma_company.id,
            name="Sofia Romero",
            email="sofia@lumastudio.io",
            phone="+1-323-555-0128",
            status=ContactStatus.customer,
            lead_score=88,
            tags=["renewal", "design"],
            extra_data={"title": "Founder"},
            created_at=now - timedelta(weeks=4, days=1),
            updated_at=now - timedelta(weeks=2, days=5),
        )
        jordan_contact = Contact(
            organization_id=organization_id,
            owner_user_id=actor.id,
            company_id=meridian_company.id,
            name="Jordan Lee",
            email="jordan@meridianhealth.io",
            phone="+1-646-555-0189",
            status=ContactStatus.lead,
            lead_score=69,
            tags=["enterprise", "security-review"],
            extra_data={"title": "Director of Operations"},
            created_at=now - timedelta(weeks=2, days=4),
            updated_at=now - timedelta(days=6),
        )
        self.session.add_all([mia_contact, omar_contact, sofia_contact, jordan_contact])
        await self.session.flush()

        northstar_deal = Deal(
            organization_id=organization_id,
            contact_id=mia_contact.id,
            owner_user_id=actor.id,
            title="Northstar multi-market rollout",
            pipeline_stage=DealStage.closed_won,
            amount=Decimal("24500.00"),
            currency="USD",
            probability=100,
            expected_close_date=(now - timedelta(weeks=6)).date(),
            source="referral",
            description="Won expansion deal covering reporting and automation workflows.",
            created_at=now - timedelta(weeks=7, days=2),
            updated_at=now - timedelta(weeks=6),
        )
        atlas_deal = Deal(
            organization_id=organization_id,
            contact_id=omar_contact.id,
            owner_user_id=actor.id,
            title="Atlas dispatch automation pilot",
            pipeline_stage=DealStage.negotiation,
            amount=Decimal("18200.00"),
            currency="USD",
            probability=72,
            expected_close_date=(now + timedelta(days=12)).date(),
            source="linkedin",
            description="Pilot rollout for dispatcher workflows and SLA tracking.",
            created_at=now - timedelta(weeks=5, days=3),
            updated_at=now - timedelta(days=4),
        )
        luma_deal = Deal(
            organization_id=organization_id,
            contact_id=sofia_contact.id,
            owner_user_id=actor.id,
            title="Luma annual retainer renewal",
            pipeline_stage=DealStage.closed_won,
            amount=Decimal("9600.00"),
            currency="USD",
            probability=100,
            expected_close_date=(now - timedelta(weeks=2, days=4)).date(),
            source="customer_success",
            description="Renewal for project management, reporting, and client comms.",
            created_at=now - timedelta(weeks=3, days=5),
            updated_at=now - timedelta(weeks=2, days=4),
        )
        meridian_deal = Deal(
            organization_id=organization_id,
            contact_id=jordan_contact.id,
            owner_user_id=actor.id,
            title="Meridian patient operations workspace",
            pipeline_stage=DealStage.qualified,
            amount=Decimal("32000.00"),
            currency="USD",
            probability=46,
            expected_close_date=(now + timedelta(days=24)).date(),
            source="webinar",
            description="Qualified enterprise opportunity focused on operations visibility.",
            created_at=now - timedelta(weeks=1, days=6),
            updated_at=now - timedelta(days=2),
        )
        self.session.add_all([northstar_deal, atlas_deal, luma_deal, meridian_deal])
        await self.session.flush()

        northstar_project = Project(
            organization_id=organization_id,
            deal_id=northstar_deal.id,
            owner_user_id=actor.id,
            name="Northstar rollout implementation",
            status=ProjectStatus.active,
            kickoff_date=(now - timedelta(weeks=6)).date(),
            target_end_date=(now + timedelta(weeks=2)).date(),
            notes="Delivery project auto-created from closed-won deal.",
            created_at=now - timedelta(weeks=6),
            updated_at=now - timedelta(days=2),
        )
        self.session.add(northstar_project)
        await self.session.flush()

        tasks = [
            Task(
                organization_id=organization_id,
                deal_id=atlas_deal.id,
                contact_id=omar_contact.id,
                assignee_id=actor.id,
                title="Resolve procurement objections",
                description="Prepare pricing FAQ and pilot timeline for Atlas.",
                status=TaskStatus.in_progress,
                due_at=now + timedelta(days=2),
                source=TaskSource.manual,
                created_at=now - timedelta(days=5),
                updated_at=now - timedelta(days=1),
            ),
            Task(
                organization_id=organization_id,
                deal_id=meridian_deal.id,
                contact_id=jordan_contact.id,
                assignee_id=actor.id,
                title="Send security checklist",
                description="Share compliance summary before technical review.",
                status=TaskStatus.open,
                due_at=now + timedelta(days=4),
                source=TaskSource.manual,
                created_at=now - timedelta(days=3),
                updated_at=now - timedelta(days=1),
            ),
            Task(
                organization_id=organization_id,
                deal_id=luma_deal.id,
                contact_id=sofia_contact.id,
                assignee_id=actor.id,
                title="Book onboarding recap",
                description="Confirm quarterly review rhythm and onboarding materials.",
                status=TaskStatus.done,
                due_at=now - timedelta(days=6),
                source=TaskSource.automation,
                created_at=now - timedelta(weeks=2, days=3),
                updated_at=now - timedelta(days=5),
            ),
        ]

        messages = [
            Message(
                organization_id=organization_id,
                deal_id=northstar_deal.id,
                contact_id=mia_contact.id,
                author_user_id=actor.id,
                direction=MessageDirection.outbound,
                channel=MessageChannel.email,
                subject="Rollout kickoff and reporting plan",
                body="Sharing the kickoff plan and success metrics for the expansion rollout.",
                payload_meta={"thread": "northstar-kickoff"},
                ai_priority="high",
                created_at=now - timedelta(weeks=6, days=1),
                updated_at=now - timedelta(weeks=6, days=1),
            ),
            Message(
                organization_id=organization_id,
                deal_id=atlas_deal.id,
                contact_id=omar_contact.id,
                direction=MessageDirection.inbound,
                channel=MessageChannel.chat,
                subject="Pilot pricing questions",
                body="Can you break down seat pricing and confirm the onboarding timeline?",
                payload_meta={"thread": "atlas-chat"},
                ai_intent="pricing",
                ai_priority="medium",
                ai_sentiment=0.22,
                created_at=now - timedelta(days=4, hours=6),
                updated_at=now - timedelta(days=4, hours=6),
            ),
            Message(
                organization_id=organization_id,
                deal_id=luma_deal.id,
                contact_id=sofia_contact.id,
                direction=MessageDirection.inbound,
                channel=MessageChannel.email,
                subject="Renewal approved",
                body="Looks good on our side. Please send over the final onboarding recap.",
                payload_meta={"thread": "luma-renewal"},
                ai_intent="approval",
                ai_priority="low",
                ai_sentiment=0.91,
                created_at=now - timedelta(weeks=2, days=4),
                updated_at=now - timedelta(weeks=2, days=4),
            ),
            Message(
                organization_id=organization_id,
                deal_id=meridian_deal.id,
                contact_id=jordan_contact.id,
                author_user_id=actor.id,
                direction=MessageDirection.outbound,
                channel=MessageChannel.email,
                subject="Security review prep",
                body="Sending the compliance overview ahead of next week's technical call.",
                payload_meta={"thread": "meridian-security"},
                ai_priority="high",
                created_at=now - timedelta(days=2, hours=3),
                updated_at=now - timedelta(days=2, hours=3),
            ),
        ]
        self.session.add_all([*tasks, *messages])

        organization.extra_data = {
            **(organization.extra_data or {}),
            "workspace_bootstrapped_at": now.isoformat(),
            "workspace_bootstrapped_by": str(actor.id),
            "workspace_template": "starter-growth",
        }

        await self.session.commit()
        return True

    async def _get_organization(self, organization_id: UUID) -> Organization:
        organization = await self.session.scalar(
            select(Organization).where(Organization.id == organization_id)
        )
        if organization is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Organization not found.",
            )
        return organization

    async def _build_workspace_read(self, organization: Organization) -> WorkspaceRead:
        stats = await self._get_workspace_stats(organization.id)
        organization_payload = OrganizationRead.model_validate(organization).model_dump()
        return WorkspaceRead(
            **organization_payload,
            stats=stats,
            crm_ready=self._has_crm_data(stats),
        )

    async def _get_workspace_stats(self, organization_id: UUID) -> WorkspaceStats:
        members = await self.session.scalar(
            select(func.count(User.id)).where(User.organization_id == organization_id)
        )
        companies = await self.session.scalar(
            select(func.count(Company.id)).where(Company.organization_id == organization_id)
        )
        contacts = await self.session.scalar(
            select(func.count(Contact.id)).where(Contact.organization_id == organization_id)
        )
        deals = await self.session.scalar(
            select(func.count(Deal.id)).where(Deal.organization_id == organization_id)
        )
        projects = await self.session.scalar(
            select(func.count(Project.id)).where(Project.organization_id == organization_id)
        )
        tasks = await self.session.scalar(
            select(func.count(Task.id)).where(Task.organization_id == organization_id)
        )
        messages = await self.session.scalar(
            select(func.count(Message.id)).where(Message.organization_id == organization_id)
        )

        return WorkspaceStats(
            members=int(members or 0),
            companies=int(companies or 0),
            contacts=int(contacts or 0),
            deals=int(deals or 0),
            projects=int(projects or 0),
            tasks=int(tasks or 0),
            messages=int(messages or 0),
        )

    def _has_crm_data(self, stats: WorkspaceStats) -> bool:
        return any(
            (
                stats.companies,
                stats.contacts,
                stats.deals,
                stats.projects,
                stats.tasks,
                stats.messages,
            )
        )
