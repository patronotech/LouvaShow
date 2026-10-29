import { useLayoutEffect, useRef, useState } from 'react';
import type { Snapshot } from '../../shared/contracts';
import './slide.css';
export function Slide({snapshot,preview=false,onOverflow}:{snapshot:Snapshot|null;preview?:boolean;onOverflow?:(value:boolean)=>void}) {
 const host=useRef<HTMLDivElement>(null), area=useRef<HTMLDivElement>(null), text=useRef<HTMLDivElement>(null);
 const [size,setSize]=useState({width:1280,height:720});
 const [font,setFont]=useState(64);
 const block=snapshot?.blocks[snapshot.blockIndex]; const theme=snapshot?.theme;
 useLayoutEffect(()=>{const node=host.current;if(!node)return;const observer=new ResizeObserver(([entry])=>{setSize({width:entry.contentRect.width,height:entry.contentRect.height});});observer.observe(node);return()=>observer.disconnect();},[]);
 const scale=Math.min(size.width/1280,size.height/720); const height=720;
 useLayoutEffect(()=>{
  const a=area.current,t=text.current;if(!a||!t)return;
  let value=theme?.fontSize??64;t.style.fontSize=`${value}px`;
  while(value>32 && (t.scrollHeight>a.clientHeight || t.scrollWidth>a.clientWidth)){value-=1;t.style.fontSize=`${value}px`;}
  setFont(value);onOverflow?.(t.scrollHeight>a.clientHeight||t.scrollWidth>a.clientWidth);
 },[block?.text,theme,height,onOverflow]);
 return <div ref={host} className={`slide-host ${preview?'slide-preview':''}`} aria-label={preview?'Prévia da saída':undefined}>
  <div className="slide-stage" style={{width:1280,height,left:(size.width-1280*scale)/2,top:(size.height-720*scale)/2,transform:`scale(${scale})`,background:theme?.backgroundColor??'#000',color:theme?.textColor??'#fff',fontFamily:theme?.fontFamily??'Arial'}}>
   <div className="slide-overlay" style={{opacity:theme?.overlayOpacity??0}}/>
   <div ref={area} className="slide-safe" style={{justifyContent:theme?.verticalAlign==='start'?'flex-start':theme?.verticalAlign==='end'?'flex-end':'center',textAlign:theme?.textAlign??'center'}}>
    <div ref={text} key={block?.id} className={theme?.transitionType==='fade'?'slide-text fade':'slide-text'} style={{fontSize:font,animationDuration:`${theme?.transitionDurationMs??0}ms`}}>{block?.text??''}</div>
   </div>
   {(!snapshot||snapshot.blanked)&&<div className="slide-blackout"/>}
  </div>
 </div>;
}
