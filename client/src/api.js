import {useState,useEffect} from 'react';

export async function api(path,{method='GET',body}={})

{const r=await fetch('/api'+path,{method,credentials:'include',headers:{'Content-Type':'application/json'},body:body&&JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Request failed');return d}
export function useApi(path,deps=[])

{const[s,set]=useState({loading:true});useEffect(()=>{if(!path){set({});return}let live=true;set({loading:true});api(path).then(data=>live&&set({data})).catch(e=>live&&set({err:e.message}));return()=>{live=false}},[path,...deps]);return s}
