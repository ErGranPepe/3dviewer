/* ===== Configuración del sitio (edita solo este archivo) =====
   adsenseClient: tu ID de editor de AdSense, p. ej. "ca-pub-1234567890123456". Vacío = sin anuncios.
   slots: IDs de los bloques de anuncio creados en AdSense (vacío = bloque automático).
   sponsors: marcas que aparecen en las vallas del circuito (acuerdos directos; no son anuncios de Google). */
window.SITE={
  adsenseClient:"",
  slots:{stage:"",content:""},
  interstitials:true,
  contact:"",
  /* Clave de Google Maps Platform (Map Tiles API) para el "mundo real" en 3D. Restríngela en Google Cloud a tu dominio. Vacío = desactivado. */
  googleMapsKey:"",
  sponsors:[],
  /* Donaciones: pon tu usuario (solo el nombre, sin la dirección completa). Vacío = no se muestra el botón «Apoya».
     kofi: ko-fi.com/<usuario> · github: github.com/sponsors/<usuario>
     paypal: tu nombre de PayPal.Me (paypal.me/<nombre>) o el enlace completo de tu botón «Donar» (https://www.paypal.com/donate/?hosted_button_id=…).
             No pongas aquí tu correo: este archivo es público.
     goal: objetivo del mes opcional (target 0 = sin barra); "raised" lo actualizas tú a mano. */
  support:{
    kofi:"mariodiazgomez",
    github:"",
    paypal:"",
    goal:{label:"Objetivo del mes",target:0,raised:0}
  }
};
window.SPONSORS=window.SITE.sponsors.length?window.SITE.sponsors:[{name:"TU MARCA AQUÍ"},{name:"ANÚNCIATE AQUÍ"}];
