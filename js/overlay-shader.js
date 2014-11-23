
var XML3D = XML3D || {};
	
(function() {


XML3D.shaders.register("overlay", {

    vertex: [
        "attribute vec3 position;",
        "attribute vec3 color;",
        "attribute vec2 texcoord;",

        "varying vec3 fragVertexColor;",
        "varying vec2 fragTexCoord;",

        "uniform mat4 modelViewProjectionMatrix;",

        "void main(void) {",
        "   fragVertexColor = color;",
        "   fragTexCoord = texcoord;",
        "   gl_Position = modelViewProjectionMatrix * vec4(position, 1.0);",
        "}"
    ].join("\n"),

    fragment: [
        "uniform vec3 diffuseColor;",
        "uniform bool useVertexColor;",

        "#if HAS_DIFFUSETEXTURE",
        "uniform sampler2D diffuseTexture;",
        "#endif",

        "varying vec3 fragVertexColor;",
        "varying vec2 fragTexCoord;",

        "void main(void) {",
        "    vec3 color = diffuseColor;",
        "    if (useVertexColor)",
        "       color *=  fragVertexColor;",
        "  #if HAS_DIFFUSETEXTURE",
        "    vec4 texDiffuse = texture2D(diffuseTexture, fragTexCoord);",
		"    float cy = step(0.0, fragTexCoord.y) * step(fragTexCoord.y, 1.0);",
		"    float cx = step(0.0, fragTexCoord.x) * step(fragTexCoord.x, 1.0);",
		"    float alpha = texDiffuse.a * cx * cy;",
        "    color = mix(color, texDiffuse.rgb, alpha);",
        "  #endif",
        "    gl_FragColor = vec4(color, 1.0);",
        "}"
    ].join("\n"),

    addDirectives: function(directives, lights, params) {
        directives.push("HAS_DIFFUSETEXTURE " + ('diffuseTexture' in params ? "1" : "0"));
    },

    uniforms: {
        diffuseColor : [1.0, 1.0, 1.0],
        useVertexColor: false
    },
    samplers: {
        diffuseTexture : null,
    },
    attributes: {
        texcoord: null,
        color: null
    }
});


})();