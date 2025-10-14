// script.js
function login(){
  const u=document.getElementById('username').value;
  const p=document.getElementById('password').value;
  if(u==='agent'&&p==='secret')window.location='dashboard.html';
  else alert('Identifiants incorrects');
}
function logout(){ window.location='login.html'; }
function goBack(){ window.history.back(); }
function filterList(){
  const f=document.getElementById('search').value.toLowerCase();
  document.querySelectorAll('#courrier-list li').forEach(li=>{
    li.style.display=li.dataset.ref.toLowerCase().includes(f)?'block':'none';
  });
}
function impute(ref){ alert('Imputation du courrier '+ref); }

// Stub pour create
if(document.getElementById('create-form')){
  document.getElementById('create-form').onsubmit=e=>{ e.preventDefault(); alert('Courrier créé'); };
}
// Stub pour user form
if(document.getElementById('user-form')){
  document.getElementById('user-form').onsubmit=e=>{ e.preventDefault(); alert('Utilisateur créé'); };
}
