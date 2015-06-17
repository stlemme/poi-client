
var Xflow = Xflow || {};
var XML3D = XML3D || {};
	
(function() {


////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

// ported from http://www.flipcode.com/archives/Efficient_Polygon_Triangulation.shtml
var Triangulate = function(contour) {
	
	this.contour = contour;
	// TODO: check whether the first and the last point are the same
	this.points = (this.contour.length / 3) - 1;
};


Triangulate.prototype.GetX = function(idx) {
	// TODO: check idx < this.points
	return this.contour[3*idx];
}

Triangulate.prototype.GetY = function(idx) {
	// TODO: check idx < this.points
	return this.contour[3*idx+2];
}

Triangulate.prototype.EPSILON = 0.0000000001;

// compute area of a contour/polygon
Triangulate.prototype.Area = function(V)
{
	var n = V.length; // this.points;
	var A = 0.0;

	for (var p=n-1, q=0; q<n; p=q++)
		A += this.GetX(V[p])*this.GetY(V[q]) - this.GetX(V[q])*this.GetY(V[p]);
	
	return 0.5*A;
}


// InsideTriangle decides if a point P is Inside of the triangle
// defined by A, B, C.
Triangulate.prototype.InsideTriangle = function(
	Ax, Ay, Bx, By, Cx, Cy,
	Px, Py
){
	var ax, ay, bx, by, cx, cy, apx, apy, bpx, bpy, cpx, cpy;
	var cCROSSap, bCROSScp, aCROSSbp;

	ax = Cx - Bx;  ay = Cy - By;
	bx = Ax - Cx;  by = Ay - Cy;
	cx = Bx - Ax;  cy = By - Ay;
	apx= Px - Ax;  apy= Py - Ay;
	bpx= Px - Bx;  bpy= Py - By;
	cpx= Px - Cx;  cpy= Py - Cy;

	aCROSSbp = ax*bpy - ay*bpx;
	cCROSSap = cx*apy - cy*apx;
	bCROSScp = bx*cpy - by*cpx;

	return ((aCROSSbp >= 0.0) && (bCROSScp >= 0.0) && (cCROSSap >= 0.0));
};


Triangulate.prototype.Snip = function(
	u, v, w,
	n, V
) {
	var p;
	var Ax, Ay, Bx, By, Cx, Cy, Px, Py;

	Ax = this.GetX(V[u]);
	Ay = this.GetY(V[u]);

	Bx = this.GetX(V[v]);
	By = this.GetY(V[v]);

	Cx = this.GetX(V[w]);
	Cy = this.GetY(V[w]);

	if (this.EPSILON > (((Bx-Ax)*(Cy-Ay)) - ((By-Ay)*(Cx-Ax))))
		return false;

	for (p=0; p<n; p++)
	{
		if( (p == u) || (p == v) || (p == w) )
			continue;
		
		Px = this.GetX(V[p]);
		Py = this.GetY(V[p]);

		if (this.InsideTriangle(Ax,Ay, Bx,By, Cx,Cy, Px,Py))
			return false;
	}

	return true;
}

Triangulate.prototype.Process = function(
	result, U
) {

	// allocate and initialize list of Vertices in polygon
	var n = this.points;
	if (n < 3)
		return false;

	// TODO: use typed array
	if (U == null) {
		U = new Array(n);
		for (var v=0; v<n; v++) U[v] = v;
	} else {
		this.points = n = U.length;
	}

	var V = new Array(n);
	// we want a counter-clockwise polygon in V
	if (0.0 < this.Area(U)) {
		for (var v=0; v<n; v++) V[v] = U[v];
	} else {
		for (var v=0; v<n; v++) V[v] = U[(n-1)-v];
	}

	var nv = n;

	// remove nv-2 Vertices, creating 1 triangle every time
	var count = 2*nv;   // error detection

	for (var m=0, v=nv-1; nv>2; )
	{
		// if we loop, it is probably a non-simple polygon
		if (0 >= (count--)) {
			// Triangulate: ERROR - probable bad polygon!
			return false;
		}

		// three consecutive vertices in current polygon, <u,v,w>
		var u = v; if (nv <= u) u = 0;    // previous
		v = u+1; if (nv <= v) v = 0;      // new v
		var w = v+1; if (nv <= w) w = 0;  // next

		if (this.Snip(u, v, w, nv, V))
		{
			var a,b,c,s,t;

			// true names of the vertices
			a = V[u]; b = V[v]; c = V[w];

			// output Triangle
			result.push(a);
			result.push(c);
			result.push(b);

			m++;

			// remove v from remaining polygon
			for (s=v, t=v+1; t<nv; s++, t++) V[s] = V[t]; nv--;

			// reset error detection counter
			count = 2*nv;
		}
	}

	return true;
}

////////////////////////////////////////////////////////////////////////////////

Xflow.registerOperator("xflow.triangulatePolygon", {
    outputs: [
		{type: 'int', name: 'index', customAlloc: true}
	],
	
    params:  [
        { type: 'float3', source: 'contour' }
    ],
	
    alloc: function(sizes, contour)
    {
		// TODO: go for "noAlloc: true"
		var tri = new Triangulate(contour);

		var result = new Array();
		tri.Process(result);
		
        sizes['index'] = result.length;
    },
	
    evaluate: function(index, contour, info)
	{
		var tri = new Triangulate(contour);

		var result = new Array();
		tri.Process(result);
		
		// TODO: check if index.length == result.length
        for (var i = 0; i < index.length; i++)
			index[i] = result[i];
		
        return true;
    }
});


////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////


Xflow.registerOperator("xflow.extrudePolygon", {
    outputs: [
		{type: 'float3', name: 'position', customAlloc: true},
		{type: 'int', name: 'index', customAlloc: true}
	],
    params:  [
        {type: 'float3', source: 'contour'},
        {type: 'float', source: 'height'}
    ],
    alloc: function(sizes, contour, height)
    {
		var points = (contour.length / 3) - 1;
        sizes['position'] = 2 * points;
		
		var wall_points = 2 * 3 * points;

		// TODO: use noAlloc: true for indices
		var tri = new Triangulate(contour);
		var result = new Array();
		tri.Process(result);
		var roof_points = result.length;
		
        sizes['index'] = wall_points + roof_points;
    },
	
    evaluate: function(position, index, contour, height, info)
	{
		var points = (contour.length / 3) - 1;
		var nv = (position.length / 3);
		// TODO: check 2*points == nv
		// console.log("points:" + points);
		// console.log("nv:" + nv);

		// clone contour points
        for (var i = 0; i < points; i++)
		{
            position[6*i  ] = contour[3*i  ];
            position[6*i+1] = contour[3*i+1];
            position[6*i+2] = contour[3*i+2];

            position[6*i+3] = contour[3*i  ];
            position[6*i+4] = contour[3*i+1] + height[0];
            position[6*i+5] = contour[3*i+2];
        }

		

		// generate indices for the walls
        for (var i = 0; i < points; i++)
		{
			var tp =  2* i;
			var np = (2*(i+1)) % nv;
			
			// TODO: check order in terms of cracks caused by interpolation issues
            index[6*i  ] = tp+1;
            index[6*i+1] = np;
            index[6*i+2] = tp;
			
            index[6*i+3] = np;
            index[6*i+4] = tp+1;
            index[6*i+5] = np+1;
		}
		
		// generate indices for the roof
		// console.log("position.length:" + position.length);
		var tri = new Triangulate(position);
		var result = new Array();
		// use every odd point from position, which is the upper contour
		var V = new Array();
		for (var i = 1; i < nv; i+=2) V.push(i);
		tri.Process(result, V);
		
		// console.log("V:" + V);
		// console.log("result:" + result);
		// console.log("index.length:" + index.length);
		
		var offset = 6*points;
		// console.log("offset:" + offset);
		for (var i = 0; i < result.length; i++)
			index[offset+i] = result[i];
		
        return true;
    }
});


////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////


Xflow.registerOperator("xflow.deindex", {
    outputs: [
		{type: 'float3', name: 'out_position', customAlloc: true}
	],
    params:  [
        { type: 'float3', source: 'position' },
        { type: 'int', source: 'index'}
    ],
    alloc: function(sizes, position, index)
    {
        sizes['out_position'] = index.length;
    },
	
    evaluate: function(out_position, position, index, info)
	{
        for (var i = 0; i < index.length; i++)
		{
			var idx = index[i];
            out_position[3*i  ] = position[3*idx  ];
            out_position[3*i+1] = position[3*idx+1];
            out_position[3*i+2] = position[3*idx+2];
        }

        return true;
    }
});


////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////


Xflow.registerOperator("xflow.planeXZ", {
    outputs: [
		{type: 'float3', name: 'out_position'}
	],
    params:  [
        {type: 'float2', source: 'in_position'}
    ],
    evaluate: function(out_position, in_position, info)
	{
        for (var i = 0; i < info.iterateCount; i++)
		{
            out_position[3*i  ] = in_position[2*i  ];
            out_position[3*i+1] = 0.0;
            out_position[3*i+2] = in_position[2*i+1];
        }
        return true;
    }
});


// Xflow.registerOperator("xflow.add", {
    // outputs: [  {type: 'float3', name: 'result'}],
    // params:  [  {type: 'float3', source: 'value1'},
                // {type: 'float3', source: 'value2'}],
    // evaluate: function(result, value1, value2, info) {
        // throw "Not used!";

        // for (var i = 0; i < info.iterateCount; i++) {
            // result[i] = value1[i] + value2[i];
		// }

        // return true;
    // },

    // evaluate_core: function(result, value1, value2){
        // result[0] = value1[0] - value2[0];
        // result[1] = value1[1] - value2[1];
        // result[2] = value1[2] - value2[2];
    // }
// });

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////


Xflow.registerOperator("xflow.generateFaceNormal", {
    outputs: [
		{type: 'float3', name: 'normal'}
	],
    params:  [
        {type: 'float3', source: 'position'}
    ],
    evaluate: function(normal, position, info)
	{
		for (var i = 0; i < info.iterateCount; i+=3)
		{
			var A = 3* i;
			var B = 3*(i+1);
			var C = 3*(i+2);
			
			var Ax = position[A  ];
			var Ay = position[A+1];
			var Az = position[A+2];

			var Bx = position[B  ];
			var By = position[B+1];
			var Bz = position[B+2];

			var Cx = position[C  ];
			var Cy = position[C+1];
			var Cz = position[C+2];
			
			var Ux = Bx - Ax;
			var Uy = By - Ay;
			var Uz = Bz - Az;
			
			var Vx = Cx - Ax;
			var Vy = Cy - Ay;
			var Vz = Cz - Az;
			
			var N = [
				Uy*Vz - Uz*Vy,
				Uz*Vx - Ux*Vz,
				Ux*Vy - Uy*Vx
			];
			
			// normalize
			var l = Math.sqrt(N[0]*N[0]+N[1]*N[1]+N[2]*N[2]);
			for (var j=0; j<3; j++) N[j] = N[j] / l;
			
			for (var j=0; j<3; j++) {
				normal[A+j] = N[j];
				normal[B+j] = N[j];
				normal[C+j] = N[j];
			}
        }
		return true;
    }
});


////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////


Xflow.registerOperator("xflow.ensureCCWContour", {
    outputs: [
		{type: 'float2', name: 'out_contour'}
	],
    params:  [
        {type: 'float2', source: 'in_contour'}
    ],
    evaluate: function(out_contour, in_contour, info)
	{

		var n = info.iterateCount; // this.points;
		var tn = 2*n;
		var A = 0.0;

		for (var p=n-1, q=0; q<n; p=q++)
			A += in_contour[2*p]*in_contour[2*q+1] - in_contour[2*q]*in_contour[2*p+1];
	
		if (0.5*A < 0.0) {
			// reverse order of vertices
			for (var i = 0; i < tn; i+=2) {
				out_contour[i  ] = in_contour[tn-i-2];
				out_contour[i+1] = in_contour[tn-i-1];
			}
			
		} else {
			// leave order as it is
			for (var i = 0; i < tn; i+=2) {
				out_contour[i  ] = in_contour[i  ];
				out_contour[i+1] = in_contour[i+1];
			}
			
		}

		return true;
    }
});


////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////


XML3D.shaders.register("normaldebug", {

    vertex: [
        "attribute vec3 position;",
        "attribute vec3 normal;",

        "varying vec3 fragVertexColor;",

        "uniform mat4 modelViewProjectionMatrix;",

        "void main(void) {",
        "   fragVertexColor = normal;",
        "   gl_Position = modelViewProjectionMatrix * vec4(position, 1.0);",
        "}"
    ].join("\n"),

    fragment: [
        "uniform vec3 diffuseColor;",

        "varying vec3 fragVertexColor;",

        "void main(void) {",
        "    vec3 color = fragVertexColor;",
        "    gl_FragColor = vec4(color, 1.0);",
        "}"
    ].join("\n"),

    uniforms: {
    },
    attributes: {
        normal: {
            required: true
        }
    }
});


//warning! modified to fit terrain generation!
Xflow.registerOperator("xflow.mygrid", {
    outputs: [	{type: 'float3', name: 'position', customAlloc: true},
				{type: 'float3', name: 'normal', customAlloc: true},
				{type: 'float2', name: 'texcoord', customAlloc: true},
				{type: 'int', name: 'index', customAlloc: true}],
    params:  [{type: 'int', source: 'size', array: true}],
    alloc: function(sizes, size)
    {
        var s = size[0];
        var t = (size.length > 1) ? size[1] : s;
        sizes['position'] = s* t;
        sizes['normal'] = s* t;
        sizes['texcoord'] = s* t;
		// TODO: use triangle strips
        sizes['index'] = (s-1) * (t-1) * 6;
        // sizes['index'] = (s*t) + (s-1)*(t-2);
    },
    evaluate: function(position, normal, texcoord, index, size) {
		var s = size[0];
        var t = (size.length > 1) ? size[1] : s;
		var l = s*t;
		
        // Create Positions
		for(var i = 0; i < l; i++) {
			var offset = i*3;
			position[offset] =  ((i % s) / (s-1));
			position[offset+1] = 0;
			position[offset+2] = (Math.floor(i/t) / (t-1));
			// position[offset+2] = ((Math.floor(i/s) / (s-1))-0.5)*2;
		}

        // Create Normals
		for(var i = 0; i < l; i++) {
			var offset = i*3;
			normal[offset] =  0;
			normal[offset+1] = 1;
			normal[offset+2] = 0;
		}
        // Create Texture Coordinates
		for(var i = 0; i < l; i++) {
			var offset = i*2;
			// tx in range [0..1] not [0..1)
            texcoord[offset] = (i%s) / (s-1);
            texcoord[offset+1] = 1.0 - (Math.floor(i/t) / (t-1));
            // texcoord[offset] = (i%s) / (s-1);
            // texcoord[offset+1] = 1.0 - (Math.floor(i/t) / (t-1));
            // texcoord[offset+1] = Math.floor(i/s) / (s-1);
		}

        // Create Indices for triangles
		var tl = (s-1) * (t-1);
		var offset = 0;
		for(var i = 0; i < tl; i++) {
			var base = i + Math.floor(i / (s-1));
			index[offset++] = base + 1;
			index[offset++] = base;
			index[offset++] = base + s;
			index[offset++] = base + s;
			index[offset++] = base + s + 1;
			index[offset++] = base + 1;
		}
		// var tl = (s-1) * (t-1);
		// var offset = 0;
		// for(var i = 0; i < t-1; i++) {
			// for(var j = 0; j < s-1; j++) {
				// var base = i*s + j;
				// index[offset++] = base + s;
				// index[offset++] = base;
				// index[offset++] = base + 1;
				// index[offset++] = base + 1;
				// index[offset++] = base + s + 1;
				// index[offset++] = base + s;
			// }
		// }
		// console.log(offset);
		// console.log(tl);
		// Create Indices for trianglestrips
		// var i = 0
		// for (var row=0; row<t-1; row++) {
			// if ( (row%2)==0 ) { // even rows
				// for (var col=0; col<s; col++) {
					// index[i++] = col + row * s;
					// index[i++] = col + (row+1) * s;
				// }
			// } else { // odd rows
				// for (var col=s-1; col>0; col--) {
					// index[i++] = col + (row+1) * s;
					// index[i++] = col - 1 + + row * s;
				// }
			// }
		// }
	}
});

Xflow.registerOperator("xflow.vertexNormal", {
	outputs: [	{type: 'float3', name: 'normal', customAlloc: true} ],
	params:  [  {type: 'float3', source: 'position', array: true },
				{type: 'int', source: 'index' } ],
	alloc: function(sizes, position, index)
	{
		sizes['normal'] = (position.length/3);
	},
	evaluate: function(normal, position, index, info) {
		var vl = position.length;
		var il = index.length;
		
		for (var i=0; i < normal.length; i++)
			normal[i] = 0;


		// for each triangle j that shares ith vertex {
		for (var j=0; j < il; j+=3) {
			// if ((index[j  ] != i) && (index[j+1] != i) && (index[j+2] != i))
				// continue;
			
			// n ← n + Normalize(Normal(v, j))
			var A = 3*index[j  ];
			var B = 3*index[j+1];
			var C = 3*index[j+2];
			
			var Ax = position[A  ];
			var Ay = position[A+1];
			var Az = position[A+2];

			var Bx = position[B  ];
			var By = position[B+1];
			var Bz = position[B+2];

			var Cx = position[C  ];
			var Cy = position[C+1];
			var Cz = position[C+2];
			
			var Ux = Bx - Ax;
			var Uy = By - Ay;
			var Uz = Bz - Az;
			
			var Vx = Cx - Ax;
			var Vy = Cy - Ay;
			var Vz = Cz - Az;
			
			var S = [
				Uy*Vz - Uz*Vy,
				Uz*Vx - Ux*Vz,
				Ux*Vy - Uy*Vx
			];
			
			// normalize
			// var l = Math.sqrt(S[0]*S[0]+S[1]*S[1]+S[2]*S[2]);
			for (var k=0; k<3; k++) {
				// var n = S[k] / l;
				var n = S[k];
				normal[A+k] += n;
				normal[B+k] += n;
				normal[C+k] += n;
			};
		}
			
			// v[i].n ← Normalize(n)
			// var l = Math.sqrt(n[0]*n[0]+n[1]*n[1]+n[2]*n[2]);
			// for (var k=0; k<3; k++) normal[k] = n[k] / l;
		// }
		
		for (var i=0; i < normal.length; i+=3) {
			var l = Math.sqrt(normal[i]*normal[i]+normal[i+1]*normal[i+1]+normal[i+2]*normal[i+2]);
			normal[i  ] = normal[i  ] / l;
			normal[i+1] = normal[i+1] / l;
			normal[i+2] = normal[i+2] / l;
		}
		// console.log(normal);
	}
});


////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////


XML3D.options.setValue("renderer-faceculling", "back");

})();
