/* ===== Configuración del sitio (edita solo este archivo) =====
   adsenseClient: tu ID de editor de AdSense, p. ej. "ca-pub-1234567890123456". Vacío = sin anuncios.
   slots: IDs de los bloques de anuncio creados en AdSense (vacío = bloque automático).
   sponsors: marcas que aparecen en las vallas del circuito (acuerdos directos; no son anuncios de Google). */
window.SITE={
  adsenseClient:"",
  slots:{stage:"",content:""},
  interstitials:true,
  contact:"",
  sponsors:[]
};
window.SPONSORS=window.SITE.sponsors.length?window.SITE.sponsors:[{name:"TU MARCA AQUÍ"},{name:"ANÚNCIATE AQUÍ"}];
