// src/pages/LandingPage.tsx

import Header        from '../components/landing/Header'
import HeroBanner    from '../components/landing/HeroBanner'
import ProductsSection from '../components/landing/ProductsSection'
import Footer        from '../components/landing/Footer'

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <HeroBanner />
        <ProductsSection />
      </main>
      <Footer />
    </div>
  )
}
