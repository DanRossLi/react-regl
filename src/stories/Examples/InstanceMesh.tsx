import React from 'react'
import regl, { ReglFrame } from '../../'
import { mat4 } from 'gl-matrix';
import bunny from 'bunny';
import normals from 'angle-normals'
import createCamera from 'canvas-orbit-camera';
import fit from 'canvas-fit'

var N = 15 // N bunnies on the width, N bunnies on the height.

const angle: number[] = [];
for (var i = 0; i < N * N; i++) {
  // generate random initial angle.
  angle[i] = Math.random() * (2 * Math.PI)
}

// This buffer stores the angles of all
// the instanced bunnies.
const angleBuffer = regl.buffer({
  length: angle.length * 4,
  type: 'float',
  usage: 'dynamic'
})

const Bunnies = regl({
  frag: `
  precision mediump float;
  varying vec3 vNormal;
  varying vec3 vColor;
  void main () {
    vec3 color = vColor;
    vec3 ambient = vec3(0.3) * color;
    vec3 lightDir = vec3(0.39, 0.87, 0.29);
    vec3 diffuse = vec3(0.7) * color * clamp(dot(vNormal, lightDir) , 0.0, 1.0 );
    gl_FragColor = vec4(ambient + diffuse, 1.0);
  }`,
  vert: `
  precision mediump float;
  attribute vec3 position;
  attribute vec3 normal;
  // These three are instanced attributes.
  attribute vec3 offset;
  attribute vec3 color;
  attribute float angle;
  uniform mat4 proj;
  uniform mat4 model;
  uniform mat4 view;
  varying vec3 vNormal;
  varying vec3 vColor;
  void main () {
    vNormal = normal;
    vColor = color;
    gl_Position = proj * view * model * vec4(
      +cos(angle) * position.x + position.z * sin(angle) + offset.x,
      position.y + offset.y,
      -sin(angle) * position.x  + position.z * cos(angle) + offset.z,
      1.0);
  }`,
  attributes: {
    position: bunny.positions,
    normal: normals(bunny.cells, bunny.positions),

    offset: {
      buffer: regl.buffer(
        Array(N * N).fill(0).map((_, i) => {
          var x = (-1 + 2 * Math.floor(i / N) / N) * 120
          var z = (-1 + 2 * (i % N) / N) * 120
          return [x, 0.0, z]
        })),
      divisor: 1
    },

    color: {
      buffer: regl.buffer(
        Array(N * N).fill(0).map((_, i) => {
          var x = Math.floor(i / N) / (N - 1)
          var z = (i % N) / (N - 1)
          return [
            x * z * 0.3 + 0.7 * z,
            x * x * 0.5 + z * z * 0.4,
            x * z * x + 0.35
          ]
        })),
      divisor: 1
    },

    angle: {
      buffer: () => {
        for (var i = 0; i < N * N; i++) {
          angle[i] += 0.01
        }
        angleBuffer.subdata(angle)
        return angleBuffer()
      },
      divisor: 1
    }
  },
  elements: bunny.cells,
  instances: N * N,
  uniforms: {
    proj: ({viewportWidth, viewportHeight}) =>
      mat4.perspective(
        mat4.create(),
        Math.PI / 2,
        viewportWidth / viewportHeight,
        0.01,
        1000
      ),
    model: mat4.identity(mat4.create()),
    view: regl.prop('view')
  }
})

const backgroundColor: [number,number,number,number] = [0,0,0, 1];

export const InstanceMesh = () => {
  const [camera, setCamera] = React.useState(null);
  const [view, setView] = React.useState(mat4.create());
  const canvasRef = React.useRef<HTMLCanvasElement>(null);


  React.useEffect(() => {
    const fitHandler = fit(canvasRef.current);
    const camera = createCamera(canvasRef.current)
    window.addEventListener('resize', fitHandler, false)

    // configure initial camera view.
    camera.rotate([0.0, 0.0], [0.0, -0.4])
    camera.zoom(70.0)
    setCamera(camera);
    return () => {
      window.removeEventListener('resize', fitHandler)
    }
  }, [])


  function frameTick(context, regl){
    if(!camera) return null;
    regl.clear({color: backgroundColor})
    camera.tick()
    setView(camera.view())
  }

  return (
    <ReglFrame
      forwardedRef={canvasRef}
      extensions={['angle_instanced_arrays']}
      color={backgroundColor}
      onFrame={frameTick}>
      {camera ?
       <Bunnies id="Bunnies" view={view} />
      : null }
    </ReglFrame>
  );
}
