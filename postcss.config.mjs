import tailwindPostcss from '@tailwindcss/postcss'
import autoprefixer from 'autoprefixer'

export default {
  plugins: [tailwindPostcss({ config: './tailwind.config.ts' }), autoprefixer],
}

