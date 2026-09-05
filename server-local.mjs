import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || 'gpt-5-mini';

const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.css':'text/css; charset=utf-8','.png':'image/png','.ico':'image/x-icon'};

function json(res, status, body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));}
async function bodyJson(req){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>20000)throw new Error('Requête trop grande.')}return JSON.parse(raw||'{}');}

const schema = {
  type:'object', additionalProperties:false, required:['summary','items'],
  properties:{
    summary:{type:'string'},
    items:{type:'array',minItems:1,maxItems:30,items:{
      type:'object',additionalProperties:false,
      required:['name','qty','kcal','p','c','f','confidence'],
      properties:{
        name:{type:'string'}, qty:{type:'number',minimum:0.1,maximum:5000},
        kcal:{type:'number',minimum:0,maximum:10000}, p:{type:'number',minimum:0,maximum:1000},
        c:{type:'number',minimum:0,maximum:2000}, f:{type:'number',minimum:0,maximum:1000},
        confidence:{type:'string',enum:['high','medium','low']}
      }
    }}
  }
};

async function analyzeMeal(req,res){
  if(!API_KEY)return json(res,503,{error:'Connexion IA non configurée sur le serveur. Ajoute OPENAI_API_KEY.'});
  let input;try{input=await bodyJson(req)}catch{return json(res,400,{error:'Requête invalide.'})}
  const meal=String(input.meal||'').trim();if(!meal)return json(res,400,{error:'Décris le repas à analyser.'});
  if(meal.length>3000)return json(res,400,{error:'Description trop longue.'});
  const prompt=`Tu es un assistant de suivi nutritionnel. Analyse le repas ci-dessous en français. Sépare les principaux ingrédients/aliments. Estime les quantités en g ou ml lorsque l'utilisateur donne une unité domestique (ex: 1 pomme, 1/2 avocat, 1 cuillère). Pour chaque élément, retourne les valeurs TOTALES correspondant à la quantité consommée: kcal, protéines p en g, glucides c en g, lipides f en g. N'invente pas une précision excessive. confidence indique la fiabilité de l'estimation. Réponds uniquement selon le schéma JSON.\n\nRepas: ${meal}`;
  try{
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Authorization':`Bearer ${API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:MODEL,store:false,input:prompt,text:{format:{type:'json_schema',name:'meal_nutrition',strict:true,schema}}})});
    const data=await r.json();
    if(!r.ok){console.error('OpenAI error',data);return json(res,502,{error:'Le service IA a refusé la demande. Vérifie la clé API et le modèle configuré.'});}
    const text=data.output_text || (data.output||[]).flatMap(o=>o.content||[]).find(c=>c.type==='output_text')?.text;
    if(!text)return json(res,502,{error:'Réponse IA vide.'});
    const parsed=JSON.parse(text);
    return json(res,200,parsed);
  }catch(err){console.error(err);return json(res,502,{error:'Impossible de joindre le service IA.'});}
}

async function serveStatic(req,res){
  let pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/')pathname='/index.html';
  const safe=normalize(pathname).replace(/^([.][.][/\\])+/, '').replace(/^[/\\]+/,'');
  const path=join(ROOT,safe);
  if(!path.startsWith(ROOT))return json(res,403,{error:'Interdit'});
  try{const s=await stat(path);if(!s.isFile())throw new Error();const data=await readFile(path);res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':pathname==='/index.html'?'no-cache':'public, max-age=3600'});res.end(data);}catch{res.writeHead(404);res.end('Not found');}
}

const server=http.createServer(async(req,res)=>{
  if(req.method==='POST' && req.url==='/api/analyze-meal')return analyzeMeal(req,res);
  if(req.method==='GET')return serveStatic(req,res);
  json(res,405,{error:'Méthode non autorisée'});
});
server.listen(PORT,()=>console.log(`Suivi Fitness disponible sur http://localhost:${PORT}`));
