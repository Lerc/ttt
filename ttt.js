/*
TTT Tiny Texture Tumbler
Dominic Szablewski - https://phoboslab.org

-- LICENSE: The MIT License(MIT)
Copyright(c) 2019 Dominic Szablewski
Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files(the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and / or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions :
The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

// Compress with:
// uglifyjs ttt.js --compress --screw-ie8 --mangle toplevel -o ttt.min.js

ttt=(td, only_this_index=-1,stack_depth=0) => {

	let M=Math;
  let intHash = x => {
    x *= 0xed5ad4bb;
    x ^= x >> 11;
    x = M.imul(x,0xac4c1b51);
    x ^= x >> 15;
    x = M.imul(x,0x31848bab);
    x ^= x >> 14;
    return x;
  }
 
  let makeRandom = seed => {
    let index=0;
    let random = (x=index) => {
      let pattern = intHash( (x + seed) & 0x7fffffff)
      let intValue = intHash( (x + pattern)  & 0x7fffffff);
      index=++x;
      return intValue / 0x7fffffff;
    }
    return random;
  }

	let random=makeRandom(1337);

	var ss=(v,a=0,b=1,w=v*v*v*(v*(v*6-15)+10))=>(1.0-w)*a+(w*b); 
  var positiveMod=(v,size,q=v%size)=>q<0?size-q:q;

  var makeOp= ()=>{
    var state;
    var push=v=>state.push(v);
    var pop=()=>state.pop();
    
    var stackOp=(argc,fn)=>( ()=>push(fn.apply(null,state.splice(-argc,argc))) );

    var bi= fn=>(()=>{var b=pop(); push(fn(pop(),b));});
    var un= fn=>( ()=>push(fn(pop())) );
    var p= v=>( ()=>push(v));

    var pushStateVar=name=>(()=>push(state[name]));
    
    var ops={
      "*": bi((a,b)=>a*b),    
      "/": bi((a,b)=>a/b),    
      "-": bi((a,b)=>a-b),
      "+": bi((a,b)=>a+b),
      "p": bi(perlin),
      "w": stackOp(3,wrapPerlin),
      "W": stackOp(4,wrapPerlin),
      "e": stackOp(1,ss),
      "E": stackOp(3,ss),      
      "s": un(M.sin),
      "c": un(M.cos),
      "q": un(M.sqrt),
      "a": bi(M.atan2),
      "r": stackOp(0,random),
      "<": bi(M.min),
      ">": bi(M.max),
      "l": un(M.log),
      "^": bi(M.pow),
      "P": p(M.PI),
      "~": un(M.abs),
      "#": un(M.round),
      "$": un(M.floor),
      "%": stackOp(2,positiveMod),
      "!": un(x=>1-x),
      "?": un(x=>x<=0?0:1),
      ":": ()=> {var a=pop(), b=pop(); state.push(a,b)},
      ";": ()=> {var a=pop(), b=pop(), c=pop(); state.push(a,b,c)},
      "d": ()=> {var a=pop(); state.push(a,a)}
    }
    
    for (var v of "tuvxyz") ops[v]=pushStateVar(v);
    for (var i=0; i<10;ops[""+i]=p(i++));

    return (programState,opcode)=>{ state=programState; ops[opcode](); };
  }

  var program =code=>{
      var op=makeOp();
      return (x,y,state = [])=>{
        state.x=x;
        state.y=y;
        for (var c of code) op(state,c);
        return state.pop();
      }
  }
  var perlin=(x,y,wrapX=256,wrapY=wrapX)=> {    
    

    var dg=(ix,iy,gi=random(positiveMod(iy,wrapY)*wrapX+positiveMod(ix,wrapX)*2)*M.PI*2)  =>
            ((x-ix)*M.sin(gi)) + ((y-iy)*M.cos(gi));

    var u=0|x;
    var v=0|y;
    var sx=x-u; 
    var sy=y-v;
    var u1=(u+1);
    var v1=(v+1);
    return ss(sy,ss(sx,dg(u,v),dg(u1,v)),ss(sx,dg(u,v1),dg(u1,v1)));
  }

  var wrapPerlin=(x,y,wrapX=2,wrapY=wrapX)=>perlin(x*wrapX,y*wrapY,wrapX,wrapY);


	return td.filter((d,i) => only_this_index < 0 || i == only_this_index).map(d => {
		let i = 3,
		  offsets = [-1,1,0],
			e = document.createElement('canvas'),
			c = e.getContext('2d'),
			rgba_from_2byte = c => 
				("#"+(c|65536).toString(16).slice(-4)),
			
			fill_rect = (x, y, w, h, color) => {
				c.fillStyle = rgba_from_2byte(color);
				c.fillRect(x, y, w, h);
			},

			emboss_rect= (x, y, w, h, ...colors)	=> {
				colors.map((color, j) => {
					fill_rect(x+offsets[j], y+offsets[j], w, h, color);
				})
			}

		// Set up canvas width and height
		let W = e.width = d[0];
		let H = e.height = d[1];

		// Fill with background color
		fill_rect(0, 0, W, H, d[2]);

		// Perform all the steps for this texture
		while (i < d.length) {
			let f = [
				// 0 - rectangle: x, y, width, height, top, bottom, fill
				(x, y, width, height, top, bottom, fill) => {
					emboss_rect(x, y, width, height, top, bottom, fill)
				},
				
				// 1 - rectangle_multiple: start_x, start_y, width, height, 
				//                         inc_x, inc_y, top, bottom, fill
				(sx, sy, w, h, inc_x, inc_y, top, bottom, fill) => {
					for (let x = sx; x < W; x += inc_x) {
						for (let y = sy; y < H; y += inc_y) {
							emboss_rect(x, y, w, h, top, bottom, fill);
						}
					}
				},
				
				// 2 - random noise: color, size
				(color, size) => {
					for (let x = 0; x < W; x += size) {
						for (let y = 0; y < H; y += size) {
							// Take the color value (first 3 nibbles) and 
							// randomize the alpha value (last nibble)
							// between 0 and the input alpha.
							fill_rect(x, y, size, size, (color&0xfff0) + random()*(color&15));
						}
					}
				},
				
				// 3 - text: x, y, color, font,size, text
				(x, y, color, font, size, text) => {
					c.fillStyle = rgba_from_2byte(color);
					c.font = size + 'px ' + ['sans-',''][font]+'serif';
					c.fillText(text, x, y);
				},
				
				// 4 - draw a previous texture
				// We limit the stack depth here to not end up in an infinite loop
				// by accident
				(texture_index, x, y, w, h, alpha) => {
					c.globalAlpha = alpha/15;
					(
						texture_index < td.length && stack_depth < 16 &&
						c.drawImage(ttt(td, texture_index, stack_depth+1)[0], x, y, w, h)
					);
					c.globalAlpha = 1;
				},

				// 5 - generate a stackie pattern
				(colorA,colorB,code) => {
					let vm=program(code)
					for (let x = 0; x < W; x += 1) {
						for (let y = 0; y < H; y += 1) {
							fill_rect(x, y, 1, 1, colorA);
							let l = vm(x/W,y/W);							
							c.globalAlpha = l<0?0:l>1?1:l
							fill_rect(x, y, 1, 1, colorB);
							c.globalAlpha = 1;
						}
					}
				},

			][d[i++]];
			f(...d.slice(i, i+=f.length));
		}
		return e;
	});
};
