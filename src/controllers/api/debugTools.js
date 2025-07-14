'use strict';

const boom = require('boom');
const utilitiesService = require('../../services/utilities');
const cipher = require('../../utils/cipherService');
const logger = require('../../utils/logs/logger');

/* ---------- Helper: valida contraseña maestra ---------- */
const validateMasterPassword = async (providedPassword) => {
  const tag = 'src/controllers/api/debugTools.js – validateMasterPassword';

  if (!providedPassword) {
    logger.warn(`${tag} | Falta contraseña maestra.`);
    throw boom.unauthorized('Master password is required.');
  }

  const cfg = await utilitiesService.getParametros();
  const master = cfg.find((it) => it.nombre === 'masterPassMonitoreo')?.valor;

  if (!master) {
    logger.error(`${tag} | masterPassMonitoreo no está en la BD.`);
    throw boom.internal('Master password configuration not found.');
  }
  if (providedPassword !== master) {
    logger.warn(`${tag} | Contraseña maestra incorrecta.`);
    throw boom.unauthorized('Invalid master password.');
  }
};

/* ---------- UI HTML ---------- */
exports.getCipherToolInterface = (req, res) => {
  const html = `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Herramienta de Cifrado</title>

    <!-- ====== ESTILOS (tema oscuro c/ fallback claro) ====== -->
    <style>
      :root{
        --bg1:#111;--bg2:#1e1e1e;--fg1:#e2e8f0;--fg2:#a0aec0;
        --primary:#2ba2af;--primary-h:#24919c;
        --accent:#f0ad4e;--accent-h:#d9963e;
        --error:#ef4444;--border:#2d3748;
      }
      @media(prefers-color-scheme:light){
        :root{
          --bg1:#f7fafc;--bg2:#fff;--fg1:#1a202c;--fg2:#4a5568;
          --primary:#2ba2af;--primary-h:#248a96;
          --accent:#f0ad4e;--accent-h:#ec971f;
          --error:#d9534f;--border:#e2e8f0;
        }
      }
      *{box-sizing:border-box;margin:0;padding:0}
      body{
        font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
        background:var(--bg1);color:var(--fg1);display:flex;
        justify-content:center;padding:4rem 1rem;line-height:1.5;
      }
      .container{
        max-width:720px;width:100%;background:var(--bg2);padding:2rem;
        border-radius:10px;box-shadow:0 4px 18px rgba(0,0,0,.45);
        animation:fade .5s ease-out both;
      }
      @keyframes fade{from{opacity:0;transform:translateY(10px)}to{opacity:1}}
      h1{color:var(--primary);font-size:1.75rem;text-align:center;margin-bottom:1.5rem}

      label{display:block;margin-bottom:.5rem;font-weight:600;color:var(--fg2)}
      input,textarea{
        width:100%;padding:.75rem;border-radius:6px;font-size:.95rem;
        border:1px solid var(--border);background:var(--bg1);color:var(--fg1);
        margin-bottom:1rem;
      }
      textarea{min-height:140px;resize:vertical}
      .buttons{display:flex;gap:1rem;justify-content:center;margin:1rem 0}
      button{
        all:unset;cursor:pointer;padding:.75rem 1.6rem;border-radius:6px;
        font-weight:600;color:#fff;transition:background .25s;
      }
      #encryptBtn{background:var(--primary)}
      #encryptBtn:hover{background:var(--primary-h)}
      #decryptBtn{background:var(--accent)}
      #decryptBtn:hover{background:var(--accent-h)}
      #result{background:var(--bg1);color:var(--fg1)}
      .error{color:var(--error);font-weight:600;text-align:center;margin-top:1rem}
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Herramienta de Cifrado / Descifrado</h1>

      <label for="masterPassword">Contraseña maestra</label>
      <input type="password" id="masterPassword" placeholder="Ingresa la contraseña maestra" />

      <label for="inputText">Texto de entrada</label>
      <textarea id="inputText" placeholder="Escribe o pega el texto aquí…"></textarea>

      <div class="buttons">
        <button id="encryptBtn">Cifrar</button>
        <button id="decryptBtn">Descifrar</button>
      </div>

      <label for="result">Resultado</label>
      <textarea id="result" readonly></textarea>
      <p id="errorMessage" class="error"></p>
    </div>

    <!-- ====== SCRIPT ====== -->
    <script>
      const masterField=document.getElementById('masterPassword');
      const inputField =document.getElementById('inputText');
      const output    =document.getElementById('result');
      const errorBox  =document.getElementById('errorMessage');

      async function handle(action){
        console.log('Botón:',action);
        const master=masterField.value.trim();
        const data  =inputField.value.trim();
        errorBox.textContent='';
        output.value='Procesando…';

        if(!master||!data){
          errorBox.textContent='La contraseña maestra y el texto son obligatorios.';
          output.value='';return;
        }
        try{
          const resp=await fetch('/api/debug/'+action,{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({masterPassword:master,data})
          });
          const json=await resp.json();
          if(!resp.ok) throw new Error(json.message||'Error en servidor');
          output.value=typeof json.result==='object'
            ? JSON.stringify(json.result,null,2)
            : json.result;
        }catch(err){
          output.value='';errorBox.textContent='Error: '+err.message;
        }
      }
      encryptBtn.onclick=()=>handle('encrypt');
      decryptBtn.onclick=()=>handle('decrypt');
    </script>
  </body>
  </html>
  `;

  /* --- CSP permitiendo inline CSS + JS (solo desarrollo) --- */
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
  );
  res.type('html').send(html);
};

/* ---------- Endpoints ---------- */
exports.handleEncrypt = async (req, res, next) => {
  try {
    const { masterPassword, data } = req.body;
    await validateMasterPassword(masterPassword);
    if (!data) return next(boom.badRequest('Campo "data" requerido.'));
    const encrypted = await cipher.encryptData(data);
    res.json({ result: encrypted });
  } catch (err) {
    next(err);
  }
};

exports.handleDecrypt = async (req, res, next) => {
  try {
    const { masterPassword, data } = req.body;
    await validateMasterPassword(masterPassword);
    if (!data) return next(boom.badRequest('Campo "data" requerido.'));
    const decrypted = await cipher.decryptData(data);
    res.json({ result: decrypted });
  } catch (err) {
    next(
      boom.badRequest(
        `Error al descifrar. Verifique texto/clave. Detalle: ${err.message}`,
      ),
    );
  }
};
