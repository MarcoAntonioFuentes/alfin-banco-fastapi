// src/components/landing/Footer.tsx

import { AlfinLogo } from '../shared'

export default function Footer() {
  return (
    <footer id="encuentranos" className="bg-charcoal text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">

          {/* Brand */}
          <div className="lg:col-span-1">
            <AlfinLogo variant="light" size="md" />
            <p className="text-white/50 text-sm font-body leading-relaxed mt-4 mb-5">
              Banco especializado en soluciones financieras inclusivas para todos los peruanos.
            </p>
            <div className="flex gap-3">
              {['facebook','instagram','youtube'].map(net => (
                <a key={net} href="#" aria-label={net}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-orange-500 flex items-center justify-center transition-colors duration-200">
                  <span className="text-white text-xs font-mono">{net[0].toUpperCase()}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Products */}
          <div>
            <h4 className="font-display font-semibold text-sm uppercase tracking-widest text-white/40 mb-4">Productos</h4>
            <ul className="space-y-2.5">
              {['Préstamos personales','Cuenta de ahorros','Cuenta corriente','Tarjeta de débito','Seguros'].map(item => (
                <li key={item}>
                  <a href="#" className="text-white/60 hover:text-white text-sm font-body transition-colors link-underline">{item}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div id="conocenos">
            <h4 className="font-display font-semibold text-sm uppercase tracking-widest text-white/40 mb-4">Conócenos</h4>
            <ul className="space-y-2.5">
              {['Sobre Alfin Banco','Noticias','Trabaja con nosotros','Responsabilidad social','Inversores'].map(item => (
                <li key={item}>
                  <a href="#" className="text-white/60 hover:text-white text-sm font-body transition-colors link-underline">{item}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display font-semibold text-sm uppercase tracking-widest text-white/40 mb-4">Encuéntranos</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-2.5 text-white/60 text-sm">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="mt-0.5 flex-shrink-0 text-orange-400">
                  <path d="M8 0C5.24 0 3 2.24 3 5c0 3.75 5 11 5 11s5-7.25 5-11c0-2.76-2.24-5-5-5zm0 6.5A1.5 1.5 0 118 3.5a1.5 1.5 0 010 3z"/>
                </svg>
                <span>Av. Benavides 2651, Miraflores, Lima</span>
              </li>
              <li className="flex items-center gap-2.5 text-white/60 text-sm">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-orange-400 flex-shrink-0">
                  <path d="M3.654 1.328a.678.678 0 00-1.015-.063L1.605 2.3c-.483.484-.661 1.169-.45 1.77a17.568 17.568 0 004.168 6.608 17.569 17.569 0 006.608 4.168c.601.211 1.286.033 1.77-.45l1.034-1.034a.678.678 0 00-.063-1.015l-2.307-1.794a.678.678 0 00-.58-.122l-2.19.547a1.745 1.745 0 01-1.657-.459L5.482 8.062a1.745 1.745 0 01-.46-1.657l.548-2.19a.678.678 0 00-.122-.58L3.654 1.328z"/>
                </svg>
                0800-00000 (línea gratuita)
              </li>
              <li className="flex items-center gap-2.5 text-white/60 text-sm">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-orange-400 flex-shrink-0">
                  <path d="M0 4a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H2a2 2 0 01-2-2V4zm2-1a1 1 0 00-1 1v.217l7 4.2 7-4.2V4a1 1 0 00-1-1H2zm13 2.383l-4.758 2.855L15 11.114v-5.73zm-.034 6.878L9.271 8.82 8 9.583 6.728 8.82l-5.694 3.44A1 1 0 002 13h12a1 1 0 00.966-.739zM1 11.114l4.758-2.876L1 5.383v5.73z"/>
                </svg>
                contacto@alfinbanco.pe
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-white/30 text-xs font-body">
            © 2025 Alfin Banco S.A. · Supervisado por la SBS · Todos los derechos reservados
          </p>
          <div className="flex gap-5">
            {['Términos y condiciones','Política de privacidad','Libro de reclamaciones'].map(item => (
              <a key={item} href="#" className="text-white/30 hover:text-white/60 text-xs font-body transition-colors">{item}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
