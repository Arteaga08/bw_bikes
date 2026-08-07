/**
 * BLACK AND WHITE BIKES — extensión de Tailwind
 * Copiar dentro de theme.extend en tailwind.config.js del proyecto.
 * Así los mismos nombres de tokens.css quedan disponibles como clases:
 * bg-dorado, text-negro, font-display, p-md, rounded-control, etc.
 */
module.exports = {
  theme: {
    extend: {
      colors: {
        negro:   '#0A0A0A',
        blanco:  '#FAFAFA',
        grafito: '#3A3A38',
        dorado:  '#F2B705',
        base:    '#F1F1EE',
        borde:   '#E2E2DE',
        'dorado-hover':   '#D9A404',
        'dorado-pressed': '#BF9003',
        'negro-hover':    '#2B2B29',
        'negro-pressed':  '#3A3A38',
        'btn-pri-disabled':      '#F6E4AC',
        'btn-pri-disabled-text': '#A89355',
        'btn-sec-disabled':      '#D8D8D3',
        'btn-sec-disabled-text': '#9A9A95',
      },
      fontFamily: {
        display: ['Hanken Grotesk', 'sans-serif'], // usar font-extrabold (800)
        ui:      ['Hanken Grotesk', 'sans-serif'], // usar font-medium (500)
        body:    ['Hanken Grotesk', 'sans-serif'], // usar font-normal (400)
      },
      fontSize: {
        display: ['64px', { lineHeight: '1.02', letterSpacing: '-0.5px' }],
        h1:      ['44px', { lineHeight: '1.08', letterSpacing: '-0.4px' }],
        h2:      ['30px', { lineHeight: '1.15', letterSpacing: '-0.3px' }],
        h3:      ['20px', { lineHeight: '1.30' }],
        'body-l':['16px', { lineHeight: '1.60' }],
        body:    ['14px', { lineHeight: '1.60' }],
        ui:      ['13px', { lineHeight: '1.40' }],
        eyebrow: ['11px', { lineHeight: '1.40', letterSpacing: '3px' }],
        caption: ['11px', { lineHeight: '1.50' }],
      },
      spacing: {
        xs: '4px', sm: '8px', md: '16px', lg: '24px',
        xl: '32px', '2xl': '48px', '3xl': '64px',
      },
      borderRadius: {
        control: '2px',
        card: '10px',
        'card-lg': '14px',
      },
      height: {
        control: '44px',
      },
      transitionDuration: {
        fast: '150ms',
      },
    },
  },
};
