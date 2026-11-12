const CORREO_PLATAFORMA = "kevsaga20@gmail.com";

function esc(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function cargar(clave) {
  try {
    return JSON.parse(localStorage.getItem(clave)) || [];
  } catch {
    return [];
  }
}

function guardar(clave, lista) {
  try {
    localStorage.setItem(clave, JSON.stringify(lista));
    return true;
  } catch {
    return false;
  }
}

function enlaceGmail(para, asunto) {
  return "https://mail.google.com/mail/?view=cm&to=" +
    encodeURIComponent(para) + "&su=" + encodeURIComponent(asunto);
}

function leerImagen(archivo, ancho = 600) {
  return new Promise((resolve, reject) => {
    if (!archivo || !archivo.size) return resolve("");
    if (!archivo.type.startsWith("image/")) return reject(new Error("El archivo debe ser una imagen."));

    const lector = new FileReader();
    lector.onerror = () => reject(new Error("No se pudo leer la imagen."));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("La imagen no es válida."));
      img.onload = () => {
        const escala = Math.min(1, ancho / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * escala);
        canvas.height = Math.round(img.height * escala);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  });
}


function iniciarSeccion({ clave, semillas, contenedor, dibujar, coincide, modal, crear, alAbrir }) {
  const lista = document.getElementById(contenedor);
  const dialogo = document.getElementById(modal);
  if (!lista || !dialogo) return;

  const formulario = dialogo.querySelector("form");
  const mensajeError = dialogo.querySelector(".Form-error");
  const buscador = document.querySelector("[data-buscar]");
  const filtroCiudad = document.querySelector("[data-ciudad]");

  let propios = cargar(clave);

  const todos = () => [...propios, ...semillas]; 

  function llenarCiudades() {
    if (!filtroCiudad) return;
    const actual = filtroCiudad.value;
    const ciudades = [...new Set(todos().map(x => x.ciudad).filter(Boolean))].sort();
    filtroCiudad.innerHTML = '<option value="">Todas las ciudades</option>' +
      ciudades.map(c => `<option>${esc(c)}</option>`).join("");
    filtroCiudad.value = ciudades.includes(actual) ? actual : "";
  }

  function pintar() {
    const texto = (buscador?.value || "").trim().toLowerCase();
    const ciudad = filtroCiudad?.value || "";

    const visibles = todos().filter(item =>
      (!ciudad || item.ciudad === ciudad) && (!texto || coincide(item).toLowerCase().includes(texto))
    );

    lista.innerHTML = visibles.length
      ? visibles.map(dibujar).join("")
      : '<p class="Vacio">No encontramos resultados. Prueba con otra búsqueda o publica el primero.</p>';
  }


  document.querySelectorAll(`[data-abrir="${modal}"]`).forEach(boton =>
    boton.addEventListener("click", () => {
      mensajeError.textContent = "";
      alAbrir?.(formulario);
      dialogo.showModal();
    })
  );
  dialogo.querySelectorAll("[data-cerrar]").forEach(b => b.addEventListener("click", () => dialogo.close()));
  dialogo.addEventListener("click", e => { if (e.target === dialogo) dialogo.close(); });


  formulario.addEventListener("submit", async e => {
    e.preventDefault();
    mensajeError.textContent = "";
    const boton = formulario.querySelector('[type="submit"]');
    boton.disabled = true;

    try {
      const nuevo = await crear(new FormData(formulario));
      propios.unshift({ ...nuevo, id: Date.now(), propio: true });

      if (!guardar(clave, propios)) {
        propios.shift();
        throw new Error("No se pudo guardar. Prueba con una foto más liviana.");
      }
      formulario.reset();
      dialogo.close();
      llenarCiudades();
      pintar();
    } catch (err) {
      mensajeError.textContent = err.message;
    } finally {
      boton.disabled = false;
    }
  });


  lista.addEventListener("click", e => {
    const boton = e.target.closest("[data-eliminar]");
    if (!boton) return;
    if (!confirm("¿Eliminar esta publicación?")) return;
    propios = propios.filter(p => String(p.id) !== boton.dataset.eliminar);
    guardar(clave, propios);
    llenarCiudades();
    pintar();
  });

  buscador?.addEventListener("input", pintar);
  filtroCiudad?.addEventListener("change", pintar);

  llenarCiudades();
  pintar();
}


const promotorasBase = [
  
];

function dibujarPromotora(p) {
  const foto = p.foto
    ? `<img src="${esc(p.foto)}" alt="Foto de ${esc(p.nombre)}" class="Tarjeta-im">`
    : '<i class="bi bi-person-circle sin-foto"></i>';

  const eliminar = p.propio
    ? `<button type="button" class="btn-eliminar" data-eliminar="${esc(p.id)}">Eliminar</button>`
    : "";

  return `
    <article class="Tarjeta">
      <div class="Tarjeta-img">${foto}</div>
      <h3>${esc(p.nombre)}</h3>
      <ul class="Tarjeta-info">
        <li><i class="bi bi-geo-alt"></i> ${esc(p.ciudad)}</li>
        <li><i class="bi bi-person"></i> ${esc(p.edad)} años</li>
        ${p.estatura ? `<li><i class="bi bi-rulers"></i> ${esc(p.estatura)} m</li>` : ""}
        <li><i class="bi bi-briefcase"></i> Experiencia: ${esc(p.exp)}</li>
      </ul>
      <p>${p.tags.map(t => `<span class="badge-tag">${esc(t)}</span>`).join(" ")}</p>
      <div class="Tarjeta-acciones">
        <a href="${enlaceGmail(p.email || CORREO_PLATAFORMA, "Contratar promotora - " + p.nombre)}" target="_blank" rel="noopener" class="btn-yapo">Contactar</a>
        ${eliminar}
      </div>
    </article>`;
}

iniciarSeccion({
  clave: "yapo_promotoras",
  semillas: promotorasBase,
  contenedor: "listaPromotoras",
  modal: "modalPromotora",
  dibujar: dibujarPromotora,
  coincide: p => [p.nombre, p.ciudad, p.exp, ...p.tags].join(" "),
  crear: async datos => {
    const tags = datos.getAll("tags");
    if (!tags.length) throw new Error("Elige al menos un tipo de trabajo.");
    const edad = Number(datos.get("edad"));
    if (edad < 18) throw new Error("Debes ser mayor de 18 años para publicar un perfil.");

    return {
      nombre: datos.get("nombre").trim(),
      ciudad: datos.get("ciudad").trim(),
      edad,
      estatura: datos.get("estatura").trim(),
      exp: datos.get("exp"),
      tags,
      email: datos.get("email").trim(),
      foto: await leerImagen(datos.get("foto"))
    };
  }
});


const vacantesBase = [
];

function dibujarVacante(v) {
  const imagen = v.imagen
    ? `<img src="${esc(v.imagen)}" alt="${esc(v.marca || v.titulo)}" class="Tarjeta-im">`
    : '<i class="bi bi-megaphone sin-foto"></i>';

  const filas = [
    ["bi-geo-alt-fill", [v.ciudad, v.lugar].filter(Boolean).join(" - ")],
    ["bi-clock-fill", v.horario],
    ["bi-award-fill", v.perfil && "Perfil: " + v.perfil],
    ["bi-cash-stack", v.pago]
  ].filter(([, texto]) => texto)
   .map(([icono, texto]) => `<li><i class="bi ${icono}"></i> ${esc(texto)}</li>`).join("");

  const eliminar = v.propio
    ? `<button type="button" class="btn-eliminar" data-eliminar="${esc(v.id)}">Eliminar</button>`
    : "";

  return `
    <article class="Tarjeta">
      <div class="Tarjeta-img">${imagen}</div>
      <span class="badge-tag${v.destacado ? " destacado" : ""}">${esc(v.etiqueta || "Convocatoria Abierta")}</span>
      <h3>${esc(v.titulo)}</h3>
      ${v.marca ? `<p><strong>${esc(v.marca)}</strong></p>` : ""}
      <p>${esc(v.descripcion)}</p>
      <ul class="Tarjeta-info">${filas}</ul>
      <div class="Tarjeta-acciones">
        <a href="${enlaceGmail(v.email || CORREO_PLATAFORMA, "Postulación - " + v.titulo)}" target="_blank" rel="noopener" class="enlace">Postularse / Cotizar</a>
        ${eliminar}
      </div>
    </article>`;
}

iniciarSeccion({
  clave: "yapo_vacantes",
  semillas: vacantesBase,
  contenedor: "listaVacantes",
  modal: "modalVacante",
  dibujar: dibujarVacante,
  coincide: v => [v.titulo, v.marca, v.descripcion, v.ciudad, v.perfil].join(" "),
  crear: async datos => ({
    titulo: datos.get("titulo").trim(),
    marca: datos.get("marca").trim(),
    descripcion: datos.get("descripcion").trim(),
    ciudad: datos.get("ciudad").trim(),
    lugar: datos.get("lugar").trim(),
    horario: datos.get("horario").trim(),
    perfil: datos.get("perfil").trim(),
    pago: datos.get("pago").trim(),
    email: datos.get("email").trim(),
    etiqueta: "Convocatoria Abierta",
    imagen: await leerImagen(datos.get("imagen"))
  })
});