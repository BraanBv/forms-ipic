const $=id=>document.getElementById(id);
const NIVELES=['Sin estudios','Primaria','Secundaria','Preparatoria / Bachillerato','Carrera técnica / TSU (Técnico Superior Universitario)','Universidad (Licenciatura)','Especialidad','Maestría','Doctorado'];
const PREG=['¿Qué carrera técnica / TSU estudiaste?','¿Qué licenciatura estudiaste?','¿Qué especialidad cursaste?','¿Qué maestría cursaste?','¿Qué doctorado cursaste?'];
const f=$('f'),err=$('err');let foto='',stream=null;
f.nivel.innerHTML='<option value="">Selecciona…</option>'+NIVELES.map(n=>`<option>${n}</option>`).join('');
f.nivel.onchange=()=>{const i=NIVELES.indexOf(f.nivel.value);
 $('esc-wrap').classList.toggle('hidden',i<1);if(i<1)f.escuela.value='';
 $('extra').classList.toggle('hidden',i<4);
 if(i>=4)$('extra-l').textContent=PREG[i-4];else f.carrera.value='';};

// ---- Foto: recorte cuadrado 600x600 en el navegador ----
function setFoto(src,w,h){const c=document.createElement('canvas');c.width=c.height=600;
 const s=Math.min(w,h);c.getContext('2d').drawImage(src,(w-s)/2,(h-s)/2,s,s,0,0,600,600);
 foto=c.toDataURL('image/jpeg',.88);
 for(const el of [$('fp'),$('pf')]){el.style.backgroundImage=`url(${foto})`;el.classList.add('con');}}
$('btn-sub').onclick=()=>$('file').click();
$('file').onchange=async e=>{const file=e.target.files[0];if(!file)return;err.textContent='';
 try{const bmp=await createImageBitmap(file,{imageOrientation:'from-image'});setFoto(bmp,bmp.width,bmp.height);}
 catch{err.textContent='No se pudo leer la imagen. Usa un archivo JPG o PNG.';}e.target.value='';};
function cerrarCam(){stream&&stream.getTracks().forEach(t=>t.stop());stream=null;$('cam').classList.add('hidden');}
$('btn-cam').onclick=async()=>{err.textContent='';
 try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280}},audio:false});
  $('vid').srcObject=stream;$('cam').classList.remove('hidden');}
 catch{err.textContent='No se pudo abrir la cámara. Revisa los permisos o sube una foto.';}};
$('btn-cap').onclick=()=>{const v=$('vid');setFoto(v,v.videoWidth,v.videoHeight);cerrarCam();};
$('btn-x').onclick=cerrarCam;

f.onsubmit=async e=>{e.preventDefault();err.textContent='';
 if(!foto){err.textContent='Agrega tu foto de perfil.';return;}
 const body={...Object.fromEntries(new FormData(f)),foto};delete body.file;
 try{const r=await fetch('/api/registro',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const d=await r.json();if(!r.ok)throw new Error(d.error);
  $('dl').href='/api/credencial/'+d.id;
  $('form-card').classList.add('hidden');$('ok').classList.remove('hidden');
 }catch(x){err.textContent=x.message||'Error al enviar.';}};
