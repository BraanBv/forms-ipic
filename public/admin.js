const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
const count=(arr,k)=>arr.reduce((m,r)=>{const v=r[k]||'(sin dato)';m[v]=(m[v]||0)+1;return m;},{});
function chart(id,title,obj,type){new Chart($(id),{type,data:{labels:Object.keys(obj),datasets:[{data:Object.values(obj),label:title,backgroundColor:['#3b82f6','#ec4899','#f59e0b','#10b981','#8b5cf6','#ef4444','#14b8a6','#f97316','#64748b']}]},
 options:{plugins:{title:{display:true,text:title},legend:{display:type!=='bar'}},scales:type==='bar'?{y:{beginAtZero:true,ticks:{precision:0}}}:{}}});}
async function load(token){
 const r=await fetch('/api/admin/registros',{headers:{Authorization:'Bearer '+token}});
 if(!r.ok){$('err').textContent='Sesión inválida.';return;}
 const d=await r.json();$('login').classList.add('hidden');$('panel').classList.remove('hidden');$('total').textContent=d.length;
 $('tb').innerHTML=d.map(x=>`<tr><td>${esc(x.nombre)}</td><td>${esc(x.genero)}</td><td>${esc(x.correo)}</td><td>${esc(x.telefono)}</td><td>${esc(x.nivel)}</td><td>${esc(x.carrera)}</td><td>${new Date(x.fecha).toLocaleString('es-MX')}</td></tr>`).join('');
 chart('c1','Género',count(d,'genero'),'doughnut');chart('c2','Nivel de estudios',count(d,'nivel'),'bar');
 chart('c3','Carreras registradas',count(d.filter(x=>x.carrera),'carrera'),'bar');}
$('go').onclick=async()=>{const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user:$('u').value,pass:$('p').value})});
 const d=await r.json();if(!r.ok){$('err').textContent=d.error;return;}sessionStorage.setItem('t',d.token);load(d.token);};
if(sessionStorage.getItem('t'))load(sessionStorage.getItem('t'));
