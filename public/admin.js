const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toUpperCase();
// Agrupa ignorando mayúsculas, acentos y espacios repetidos
function count(arr,k,top){const m=new Map();
 for(const r of arr){const raw=(r[k]||'').trim();if(!raw)continue;const key=norm(raw);const e=m.get(key)||{n:0,label:raw};e.n++;m.set(key,e);}
 let a=[...m.values()].sort((x,y)=>y.n-x.n);if(top)a=a.slice(0,top);
 return Object.fromEntries(a.map(e=>[e.label,e.n]));}
const COLORS=['#3b82f6','#ec4899','#f59e0b','#10b981','#8b5cf6','#ef4444','#14b8a6','#f97316','#64748b','#0ea5e9'];
function chart(id,title,obj,type,horiz){new Chart($(id),{type,data:{labels:Object.keys(obj),datasets:[{data:Object.values(obj),label:title,backgroundColor:COLORS}]},
 options:{indexAxis:horiz?'y':'x',plugins:{title:{display:true,text:title},legend:{display:type!=='bar'}},
 scales:type==='bar'?{[horiz?'x':'y']:{beginAtZero:true,ticks:{precision:0}}}:{}}});}
async function load(token){
 const r=await fetch('/api/admin/registros',{headers:{Authorization:'Bearer '+token}});
 if(!r.ok){$('err').textContent='Sesión inválida.';return;}
 const d=await r.json();$('login').classList.add('hidden');$('panel').classList.remove('hidden');$('total').textContent=d.length;
 $('tb').innerHTML=d.map(x=>`<tr><td>${esc(x.nombre)}</td><td>${esc(x.genero)}</td><td>${esc(x.correo)}</td><td>${esc(x.telefono)}</td><td>${esc(x.nivel)}</td><td>${esc(x.escuela||'')}</td><td>${esc(x.carrera)}</td><td>${new Date(x.fecha).toLocaleString('es-MX')}</td></tr>`).join('');
 chart('c1','Género',count(d,'genero'),'doughnut');chart('c2','Nivel de estudios',count(d,'nivel'),'bar');
 chart('c3','Carreras registradas (top 10)',count(d,'carrera',10),'bar',true);
 chart('c4','Escuelas de procedencia (top 10)',count(d,'escuela',10),'bar',true);}
$('go').onclick=async()=>{const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user:$('u').value,pass:$('p').value})});
 const d=await r.json();if(!r.ok){$('err').textContent=d.error;return;}sessionStorage.setItem('t',d.token);load(d.token);};
if(sessionStorage.getItem('t'))load(sessionStorage.getItem('t'));
