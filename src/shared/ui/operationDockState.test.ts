import { describe, expect, it } from 'vitest';
import { clampDockHeight, defaultDockState, dockMaximum, dragDockHeight, readDockState } from './operationDockState';
describe('barra de operação redimensionável',()=>{
 it('inicia com altura automática e aberta',()=>{expect(readDockState(null)).toEqual(defaultDockState);expect(readDockState('{')).toEqual(defaultDockState);});
 it('restaura altura e recolhimento sem interpretar versões futuras',()=>{expect(readDockState('{"version":1,"height":140,"collapsed":true}')).toEqual({version:1,height:140,collapsed:true});expect(readDockState('{"version":2,"height":140,"collapsed":true}')).toEqual(defaultDockState);});
 it('limita altura a 45% da janela ou 320px',()=>{expect(dockMaximum(600)).toBe(270);expect(dockMaximum(1000)).toBe(320);expect(clampDockHeight(10,800)).toBe(48);expect(clampDockHeight(500,600)).toBe(270);});
 it('arrastar para cima expande e para baixo reduz sem inverter limites',()=>{expect(dragDockHeight(100,500,460,800)).toBe(140);expect(dragDockHeight(100,500,800,800)).toBe(48);expect(dragDockHeight(100,500,0,800)).toBe(320);});
 it('preserva altura preferida para restaurar após janela menor',()=>{const saved=readDockState('{"version":1,"height":300,"collapsed":false}');expect(clampDockHeight(saved.height!,400)).toBe(180);expect(clampDockHeight(saved.height!,1000)).toBe(300);expect(readDockState('{"version":1,"height":"bad","collapsed":"yes"}')).toEqual(defaultDockState);});
});
