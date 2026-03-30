import tailwindPostcss from '@tailwindcss/postcss'
import autoprefixer from 'autoprefixer'

export default {
  plugins: [tailwindPostcss({ config: './tailwind.config.ts' }), autoprefixer],
}


import axios from "axios"
import dotenv from "dotenv"

dotenv.config();

const kimiApiKey = process.env.KIMI_API_KEY;

