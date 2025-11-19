import type { Metadata } from 'next'

const defaultUrl = process.env.NODE_ENV === 'production' 
  ? 'https://donna-clean.vercel.app' 
  : 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: 'Donna Clean',
  description: 'Your amazing app',
}
