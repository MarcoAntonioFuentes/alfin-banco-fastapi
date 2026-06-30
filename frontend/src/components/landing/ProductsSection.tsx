// src/components/landing/ProductsSection.tsx

import { useNavigate } from 'react-router-dom'

const products = [
  {
    id: 'prestamo',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
        <rect width="40" height="40" rx="12" fill="#FF4F00" fillOpacity="0.12"/>
        <path d="M20 8C13.373 8 8 13.373 8 20s5.373 12 12 12 12-5.373 12-12S26.627 8 20 8zm1 17h-2v-5h2v5zm0-7h-2v-2h2v2z" fill="#FF4F00"/>
        <path d="M20 14v2M20 24v2M16 20h-2M26 20h-2" stroke="#FF4F00" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="20" cy="20" r="6" stroke="#FF4F00" strokeWidth="1.5"/>
        <path d="M18 19l1.5 1.5L22 17" stroke="#FF4F00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title:    'Quiero obtener un préstamo',
    desc:     'Con solo tu DNI, sin fiadores. Montos desde S/ 500 hasta S/ 50,000 con tasas competitivas.',
    tag:      'Aprobación en 24h',
    tagColor: 'bg-orange-100 text-orange-700',
    cta:      'Solicitar ahora',
    accent:   'orange',
  },
  {
    id: 'ahorros',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
        <rect width="40" height="40" rx="12" fill="#7A1D8A" fillOpacity="0.12"/>
        <path d="M28 18c0-4.418-3.582-8-8-8s-8 3.582-8 8c0 2.972 1.623 5.565 4 6.937V27h8v-2.063c2.377-1.372 4-3.965 4-6.937z" fill="#7A1D8A" fillOpacity="0.2"/>
        <path d="M28 18c0-4.418-3.582-8-8-8s-8 3.582-8 8c0 2.972 1.623 5.565 4 6.937V27h8v-2.063C27.377 23.565 29 20.972 29 18z" stroke="#7A1D8A" strokeWidth="1.5"/>
        <path d="M17 29h6M18 27v2M22 27v2" stroke="#7A1D8A" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M17 18l1.5 1.5L22 15" stroke="#7A1D8A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title:    'Quiero ahorrar',
    desc:     'Cuenta de ahorros libre con hasta 3% de interés anual. Sin monto mínimo para abrir.',
    tag:      'TEA hasta 3%',
    tagColor: 'bg-violet-100 text-violet-700',
    cta:      'Empezar a ahorrar',
    accent:   'violet',
  },
  {
    id: 'cuenta',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
        <rect width="40" height="40" rx="12" fill="#059669" fillOpacity="0.12"/>
        <rect x="8" y="13" width="24" height="16" rx="3" fill="#059669" fillOpacity="0.15"/>
        <rect x="8" y="13" width="24" height="16" rx="3" stroke="#059669" strokeWidth="1.5"/>
        <path d="M8 18h24" stroke="#059669" strokeWidth="1.5"/>
        <rect x="12" y="22" width="6" height="3" rx="1" fill="#059669"/>
        <circle cx="27" cy="23.5" r="2" fill="#059669" fillOpacity="0.5"/>
        <circle cx="27" cy="23.5" r="1" fill="#059669"/>
      </svg>
    ),
    title:    'Quiero una cuenta para mi día a día',
    desc:     'Cuenta corriente digital con tarjeta de débito Mastercard, transferencias y pagos instantáneos.',
    tag:      'Sin costo de mantenimiento',
    tagColor: 'bg-green-100 text-green-700',
    cta:      'Abrir cuenta',
    accent:   'green',
  },
]

export default function ProductsSection() {
  const navigate = useNavigate()

  return (
    <section id="soluciones" className="py-24 bg-pearl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-block text-orange-500 font-display font-semibold text-sm uppercase tracking-widest mb-3">
            Nuestros productos
          </span>
          <h2 className="font-display font-bold text-4xl sm:text-5xl text-charcoal mb-4">
            Soluciones que se{' '}
            <span className="relative">
              <span className="relative z-10 text-violet-500">adaptan</span>
              <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 120 8" fill="none">
                <path d="M2 6 Q60 2 118 6" stroke="#FF4F00" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </span>
            {' '}a ti
          </h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto font-body">
            Productos financieros diseñados para los peruanos de hoy. Simples, digitales y sin letra pequeña.
          </p>
        </div>

        {/* Product cards */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} delay={i * 100} onCta={() => navigate('/login')} />
          ))}
        </div>

        {/* Stats bar */}
        <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { value: '+200K', label: 'Clientes satisfechos' },
            { value: 'S/ 500M', label: 'En créditos otorgados' },
            { value: '24h',    label: 'Aprobación promedio'  },
            { value: '100%',   label: 'Digital y seguro'     },
          ].map(stat => (
            <div key={stat.label} className="text-center p-6 rounded-2xl bg-white border border-gray-100 shadow-card hover:shadow-card-hover transition-shadow duration-300">
              <p className="font-display font-bold text-3xl text-violet-500 mb-1">{stat.value}</p>
              <p className="text-gray-500 text-sm font-body">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ProductCard({ product: p, delay, onCta }: { product: typeof products[0]; delay: number; onCta: () => void }) {
  return (
    <div
      className="group relative bg-white rounded-3xl p-7 border border-gray-100 shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 cursor-pointer flex flex-col"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Top accent line */}
      <div className={`absolute top-0 left-6 right-6 h-0.5 rounded-full transition-all duration-300 group-hover:left-0 group-hover:right-0 group-hover:rounded-none group-hover:rounded-t-3xl ${
        p.accent === 'orange' ? 'bg-orange-500' : p.accent === 'violet' ? 'bg-violet-500' : 'bg-emerald-500'
      }`} />

      {/* Icon */}
      <div className="mb-5">{p.icon}</div>

      {/* Tag */}
      <span className={`inline-block text-xs font-display font-semibold px-2.5 py-1 rounded-full mb-3 ${p.tagColor}`}>
        {p.tag}
      </span>

      {/* Text */}
      <h3 className="font-display font-bold text-xl text-charcoal mb-3 leading-snug">{p.title}</h3>
      <p className="text-gray-500 font-body text-sm leading-relaxed flex-1">{p.desc}</p>

      {/* CTA */}
      <button
        onClick={onCta}
        className={`mt-6 w-full py-3 rounded-xl font-display font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 group/btn ${
          p.accent === 'orange'
            ? 'bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white'
            : p.accent === 'violet'
            ? 'bg-violet-50 text-violet-600 hover:bg-violet-500 hover:text-white'
            : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white'
        }`}
      >
        {p.cta}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" className="group-hover/btn:translate-x-1 transition-transform">
          <path d="M7 1l.5.5 5 5a.5.5 0 010 .708l-5 5-.708-.708L11.293 7H1.5a.5.5 0 010-1h9.793L6.793 1.707 7 1z"/>
        </svg>
      </button>
    </div>
  )
}
