// @vitest-environment jsdom
import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {it,expect,vi} from 'vitest'
import {BookOwnedCart} from './BookOwnedCart'
it.each([false,true])('success counter uses existing pop and respects reduced motion=%s',async reduced=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});vi.useFakeTimers();vi.stubGlobal('matchMedia',()=>({matches:reduced}))
 const node=document.createElement('div');document.body.append(node);const root=createRoot(node)
 try {
  await act(async()=>root.render(<BookOwnedCart successCount={0}/>));const idle=node.querySelector('img')!.src
  await act(async()=>root.render(<BookOwnedCart successCount={1}/>));await act(async()=>vi.advanceTimersByTimeAsync(80))
  expect(node.querySelector('img')!.src===idle).toBe(reduced)
 } finally {await act(async()=>root.unmount());node.remove();vi.useRealTimers();vi.unstubAllGlobals()}
})
