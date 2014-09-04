
var Xflow = Xflow || {};
var XML3D = XML3D || {};
	
(function() {


////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

var Triangulate = function(contour) {

	this.contour = contour;
	// TODO: check whether the first and the last point are the same
	this.points = (this.contour.length / 3) - 1;

  // triangulate a contour/polygon, places results in STL vector
  // as series of triangles.
  // this.Process = function(contour, result);

  // decide if point Px/Py is inside triangle defined by
  // (Ax,Ay) (Bx,By) (Cx,Cy)
  // this.InsideTriangle = function(Ax, Ay, Bx, By, Cx, Cy, Px, Py) {
  // }

  // this.Snip = function(contour, u, v, w, n, V) {}
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
Triangulate.prototype.Area = function()
{
	var n = this.points;
	var A = 0.0;

	for (var p=n-1, q=0; q<n; p=q++)
		A += this.GetX(p)*this.GetY(q) - this.GetX(q)*this.GetY(p);
	
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
	result
) {

	// allocate and initialize list of Vertices in polygon
	var n = this.points;
	if (n < 3)
		return false;

	// TODO: use typed array
	var V = new Array(n);

	// we want a counter-clockwise polygon in V
	if (0.0 < this.Area(contour)) {
		for (var v=0; v<n; v++) V[v] = v;
	} else {
		for (var v=0; v<n; v++) V[v] = (n-1)-v;
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
			// TODO: output indices only
			result.push_back(a);
			result.push_back(b);
			result.push_back(c);

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
		{type: 'int', name: 'index'}
	],
    params:  [
        { type: 'float3', source: 'contour' }
    ],
    // alloc: function(sizes, contour)
    // {
		// var points = (contour.length / 3) - 1;
		// console.log("alloc position.length: " + position.length);
		// console.log("alloc points: " + points);
        // sizes['index'] = 2 * 3 * points;
    // },
	
    evaluate: function(index, contour, info)
	{
		var tri = new Triangulate(contour);

		var result = new Array();
		tri.Process(result);
		
		console.log(result);
		
        for (var i = 0; i < contour.length; i+=3)
		{
			index[i  ] = 0;
			index[i+1] = 1;
			index[i+2] = 2;
		}
		
		// index.assign(result);
		
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
        sizes['index'] = 2 * 3 * points;
    },
	
    evaluate: function(position, index, contour, height, info)
	{
		var points = (position.length / 3);

        for (var i = 0; i < points; i++)
		{
            position[6*i  ] = contour[3*i  ];
            position[6*i+1] = contour[3*i+1];
            position[6*i+2] = contour[3*i+2];

            position[6*i+3] = contour[3*i  ];
            position[6*i+4] = contour[3*i+1] + height[0];
            position[6*i+5] = contour[3*i+2];
        }

        for (var i = 0; i < points; i++)
		{
			var tp = 2* i;
			var np = (2*(i+1))%points;
			
			// TODO: check order in terms of cracks caused by interpolation issues
            index[6*i  ] = tp+1;
            index[6*i+1] = np;
            index[6*i+2] = tp;
			
            index[6*i+3] = np  ;
            index[6*i+4] = tp+1;
            index[6*i+5] = np+1;
		}
		
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


////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////


XML3D.options.setValue("renderer-faceculling", "back");

})();
