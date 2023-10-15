import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.157.0/three.module.min.js';
import * as CANNON from './cannon-es.js';
import { PointerLockControlsCannon } from './PointerLockControlsCannon.js'

const instructions = document.getElementById('instructions')
const win = document.getElementById('win')
const score = document.getElementById('score')
const audio = document.getElementById("audio")
audio.volume = audio.volume * 0.5;
const successSound = document.getElementById("successSound")
const winSound = document.getElementById("winSound")
const loadingScreen = document.getElementById('loading-screen');

let count = 0;

// three.js variables
let camera, scene, renderer, stats
let material
let floor
let pointLight
// const loading 
const loadingManger = new THREE.LoadingManager(
    // loaded
    () => {
        if( loadingScreen){
            loadingScreen.remove()
        }
    },
    // progress 
    () => {
        console.log( 'progress')
    }
)
let textureLoader =  new THREE.TextureLoader(loadingManger)
let crosshair

// cannon.js variables
let world
let controls
const timeStep = 1 / 60
let lastCallTime = performance.now() / 1000
let sphereShape
let sphereBody
let physicsMaterial
const objectsToUpdate = [];
const findObjectsToUpdate = [];

let initialX = 3
let initialY = 1.5
let initialZ = -38


// Textures  
const grassColorTexture = textureLoader.load('./textures/grass2/color.jpg')
const grassAmbientOcclusionTexture = textureLoader.load('./textures/grass2/ambientOcclusion.jpg')
const grassNormalTexture = textureLoader.load('./textures/grass2/normal.jpg')
const grassRoughnessTexture = textureLoader.load('./textures/grass2/roughness.jpg')
const bricksColorTexture = textureLoader.load('./textures/bricks2/color.jpg')
const bricksAmbientOcclusionTexture = textureLoader.load('./textures/bricks2/ambientOcclusion.jpg')
const bricksNormalTexture = textureLoader.load('./textures/bricks2/normal.jpg')
const bricksRoughnessTexture = textureLoader.load('./textures/bricks2/roughness.jpg')
// Create box
const boxGeometry = new THREE.BoxGeometry(1, 1, 1)
const boxMaterial = new THREE.MeshStandardMaterial({
    map: bricksColorTexture,
    aoMap: bricksAmbientOcclusionTexture,
    normalMap: bricksNormalTexture,
    roughnessMap: bricksRoughnessTexture, 
    side: THREE.DoubleSide,
    roughness: 0.5,
    metalness: 0.8,
})
const sphereColorTexture =  textureLoader.load('./textures/balls/color.jpg' )
const sphereAmbientOcclusionTexture =  textureLoader.load('./textures/balls/ambientOcclusion.jpg' )
const sphereNormalTexture =  textureLoader.load('./textures/balls/normal.jpg' )
const sphereRoughnessTexture =  textureLoader.load('./textures/balls/roughness.jpg' )
// Create box
const findBoxGeometry = new THREE.SphereGeometry(0.5)
const findBoxMaterial = new THREE.MeshStandardMaterial({
    map: sphereColorTexture,
    aoMap: sphereAmbientOcclusionTexture,
    normalMap: sphereNormalTexture,
    roughnessMap: sphereRoughnessTexture, 
    roughness: 0.5,
    metalness: 0.8,
})

initThree()
initCannon()
shoot()
initPointerLock()
animate()

function initThree() {
    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)


    // Scene
    scene = new THREE.Scene()
    textureLoader.load('./images/backgroundPhoto.jpg' , function(texture)
    {
        scene.background = texture;  
    })


    const crosshairSize = 0.003;
    const crosshairGeometry = new THREE.SphereGeometry(crosshairSize);
    const crosshairMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    crosshair = new THREE.Mesh(crosshairGeometry, crosshairMaterial);
    crosshair.position.z = -0.2; // Position the crosshair in front of the camera
    camera.add(crosshair);


    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(window.innerWidth, window.innerHeight)


    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    document.body.appendChild(renderer.domElement)


    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0)
    scene.add(ambientLight)

    pointLight = new THREE.PointLight(0xffffff, 10)
    pointLight.position.copy( camera.position )
    scene.add(pointLight)



    // Generic material
    material = new THREE.MeshLambertMaterial({ color: 0xdddddd })




    let grassSet = 20;
    grassColorTexture.repeat.set(grassSet, grassSet)
    grassAmbientOcclusionTexture.repeat.set(grassSet, grassSet)
    grassNormalTexture.repeat.set(grassSet, grassSet)
    grassRoughnessTexture.repeat.set(grassSet, grassSet)

    grassColorTexture.wrapS = THREE.RepeatWrapping
    grassAmbientOcclusionTexture.wrapS = THREE.RepeatWrapping
    grassNormalTexture.wrapS = THREE.RepeatWrapping
    grassRoughnessTexture.wrapS = THREE.RepeatWrapping

    grassColorTexture.wrapT = THREE.RepeatWrapping
    grassAmbientOcclusionTexture.wrapT = THREE.RepeatWrapping
    grassNormalTexture.wrapT = THREE.RepeatWrapping
    grassRoughnessTexture.wrapT = THREE.RepeatWrapping

    // Floor
    const floorGeometry = new THREE.PlaneGeometry(45, 45)
    floorGeometry.rotateX(-Math.PI / 2)
    floor = new THREE.Mesh(floorGeometry, new THREE.MeshStandardMaterial({
            map: grassColorTexture,
            aoMap: grassAmbientOcclusionTexture,
            normalMap: grassNormalTexture,
            roughnessMap: grassRoughnessTexture
        }))
    floor.position.x = 20
    floor.position.z = -20
    scene.add(floor)

    window.addEventListener('resize', onWindowResize)
}

function onWindowResize() {
camera.aspect = window.innerWidth / window.innerHeight
camera.updateProjectionMatrix()
renderer.setSize(window.innerWidth, window.innerHeight)
}

function initCannon() {
    world = new CANNON.World()

    world.defaultContactMaterial.contactEquationStiffness = 1e9
    world.defaultContactMaterial.contactEquationRelaxation = 4

    const solver = new CANNON.GSSolver()
    solver.iterations = 7
    solver.tolerance = 0.1
    world.solver = new CANNON.SplitSolver(solver)
    world.gravity.set(0, -9.8, 0)
    world.broadphase.useBoundingBoxes = true

    physicsMaterial = new CANNON.Material('physics')
    const physics_physics = new CANNON.ContactMaterial(physicsMaterial, physicsMaterial, {
        friction: 0.1,
        restitution: 0.7
    })
    world.addContactMaterial(physics_physics)

    // Create the user collision sphere
    const radius = 1.3
    sphereShape = new CANNON.Sphere(radius)
    sphereBody = new CANNON.Body({ mass: 1, material: physicsMaterial })
    sphereBody.addShape(sphereShape)
    sphereBody.position.set(initialX, initialY,  initialZ)
    sphereBody.linearDamping = 0.9

    world.addBody(sphereBody)

    // Create the ground plane
    const groundShape = new CANNON.Plane()
    const groundBody = new CANNON.Body({ mass: 0, material: physicsMaterial })
    groundBody.addShape(groundShape)
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
    world.addBody(groundBody)


    const createFindBox = (position) =>
    {

            // Three.js mesh
            const mesh = new THREE.Mesh( findBoxGeometry, findBoxMaterial )
            mesh.position.copy(position)
            scene.add(mesh)

            // Cannon.js body
            const shape = new CANNON.Sphere( 0.5  )

            const body = new CANNON.Body({
                mass: 5,
                position: new CANNON.Vec3(0, 3, 0),
                shape: shape,
                material: physicsMaterial
            })
            body.position.copy(position)
            world.addBody(body)

            // Save in objects
            findObjectsToUpdate.push({ mesh, body })
    }

    createFindBox( {x: 8, y: 1.5, z: -18})
    createFindBox( { x: 2, y: 1.5, z: -2})
    createFindBox( { x: 38, y: 1.5, z: -3})
    createFindBox( { x: 13, y: 1.5, z: -34})
    createFindBox( { x: 30, y: 1.5, z: -31})


    const createBox = (width, height, depth, position) =>
    {
        // Three.js mesh
        const mesh = new THREE.Mesh(boxGeometry, boxMaterial)
        mesh.scale.set(width, height, depth)
        mesh.position.copy(position)
        scene.add(mesh)

        // Cannon.js body
        const shape = new CANNON.Box(new CANNON.Vec3(width * 0.5, height * 0.5, depth * 0.5))

        const body = new CANNON.Body({
            mass: 5000,
            position: new CANNON.Vec3(0, 3, 0),
            shape: shape,
            material: physicsMaterial
        })
        body.position.copy(position)
        world.addBody(body)

        // Save in objects
        objectsToUpdate.push({ mesh, body })
    }

    createBox(20, 4, 0.25, { x: 0 + (20/2) , y: 2, z: 0.25 - 0.125  })
    createBox(20, 4, 0.25, { x: 20 + (20/2) , y: 2, z: 0.25 - 0.125  })
    createBox(0.25, 4, 10, { x: 0 - 0.125, y: 2, z: 0 - (10/2)  })
    createBox(0.25, 4, 10, { x: 0 - 0.125, y: 2, z: -10 - (10/2)  })
    createBox(0.25, 4, 10, { x: 0 - 0.125, y: 2, z: -20 - (10/2)  })
    createBox(0.25, 4, 10, { x: 0 - 0.125, y: 2, z: -30 - (10/2)  })
    createBox(11, 4, 0.25, { x: 0 + (11/2), y: 2, z: -5.8 - 0.125  })
    createBox(11, 4, 0.25, { x: 11 + (11/2), y: 2, z: -5.8 - 0.125  })
    createBox(0.25, 4, 6, { x: 6 + 0.125 , y: 2, z: -6 - 3  })
    createBox(6.17, 4, 0.25, { x: 0.2 + 2.95 , y: 2, z: -23 -0.125   })
    createBox(0.25, 4, 6.75, { x: 6 + 0.125 , y: 2, z: -28 -(6.75/2)   })
    createBox(6, 4, 0.25, { x: 0 + 3 , y: 2, z: -34.5 -0.125  })
    createBox(0.25, 4, 6, { x: 6 + 0.125 , y: 2, z: -17 - 3  })
    createBox(6, 4, 0.25, { x: 6 + 3 , y: 2, z: -16.75 - 0.125  })
    createBox(0.25, 4, 6, { x: 12 + 0.125 , y: 2, z: -11 - 3  })
    createBox(0.25, 4, 11, { x: 12 + 0.125 , y: 2, z: -17 - (11/2)  })
    createBox(5.5, 4, 0.25, { x: 12 + ( 5.5/2) , y: 2, z: -28 - (0.25/2)  })
    createBox(0.25, 4, 10.56, { x: 28.4 + (0.25/2) , y: 2, z: -0.25 - (10.56/2)  })
    createBox(5.66, 4, 0.25, { x: 23 + (5.66/2) , y: 2, z: -10.75 - (0.25/2)  })
    createBox(0.25, 4, 5.5, { x: 22.8 + (0.25/2) , y: 2, z: -10.73 - (5.5/2)  })
    createBox(11, 4, 0.25, { x: 22.8 + (11/2) , y: 2, z: -16.25 - (0.25/2)  })
    createBox(5.65, 4, 0.25, { x: 34 + (5.65/2) , y: 2, z: -6 - (0.25/2)  })
    createBox(0.25, 4, 20, { x: 39.67 + (0.25/2) , y: 2, z: -0 - (20/2)  })
    createBox(0.25, 4, 20, { x: 39.67 + (0.25/2) , y: 2, z: -20 - (20/2)  })
    createBox(0.25, 4, 11, { x: 16.9 + (0.25/2) , y: 2, z: -11.7 - (11/2)  })
    createBox(16.68, 4, 0.25, { x: 17.09 + (16.68/2) , y: 2, z: - 22.42 - (0.25/2)  })
    createBox(0.25, 4, 5.08, { x: 33.59 + (0.25/2) , y: 2, z: - 22.65 - (5.08/2)  })
    createBox(5.54, 4, 0.25, { x: 28.3 + (5.54/2) , y: 2, z: - 27.65 - (0.25/2)  })
    createBox(0.25, 4, 5.13, { x: 28.1 + (0.25/2) , y: 2, z: - 27.7 - (5.13/2)  })
    createBox(16.54, 4, 0.25, { x: 23.05 + (16.54/2) , y: 2, z: - 32.8 - (0.25/2)  })
    createBox(0.25, 4, 5.25, { x: 22.66366 + (0.25/2) , y: 2, z: - 22.74 - (5.25/2)  })
    createBox(10, 4, 0.25, { x: 0 + (10/2) , y: 2, z: - 40 - (0.25/2)  })
    createBox(10, 4, 0.25, { x: 10 + (10/2) , y: 2, z: - 40 - (0.25/2)  })
    createBox(10, 4, 0.25, { x: 20 + (10/2) , y: 2, z: - 40 - (0.25/2)  })
    createBox(10, 4, 0.25, { x: 30 + (10/2) , y: 2, z: - 40 - (0.25/2)  })
    createBox(0.25, 4, 6.6, { x: 11.7 + (0.25/2) , y: 2, z: - 34 - (5/2)  })
    createBox(5.77, 4, 0.25, { x: 11.9 + (5.77/2) , y: 2, z: - 33.16 - (0.25/2)  })

}


function initPointerLock() {
    controls = new PointerLockControlsCannon(camera, sphereBody)
    scene.add(controls.getObject())

    instructions.addEventListener('click', () => {
        audio.play()
        controls.lock()
    })

    controls.addEventListener('lock', () => {
        controls.enabled = true
        instructions.style.display = 'none'
    })

    controls.addEventListener('unlock', () => {
        controls.enabled = false
        audio.pause()
        if( win.style.display !== 'flex') instructions.style.display = 'flex'
    })
}


function shoot(){
    let toFind = [];
    for(const object of findObjectsToUpdate)
    {
        toFind.push( object.mesh )
    }
    function removeFromArray(arr, value) {
        return arr.filter(item => item !== value);
    }
    window.addEventListener('click', () => {
    
        // Create a raycaster for click detection
        const raycaster = new THREE.Raycaster();
        let intersects = [];
    
        // Set raycaster's origin and direction to camera's position and direction
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    
        // Perform intersection check
        intersects.length = 0;
    
        raycaster.intersectObjects(toFind, false, intersects);
    
        let onWallCollision = false;
        if(intersects.length !== 0)
        {
            onWallCollision = intersects.some((intersection) => intersection.distance <= 8);
        }
    
        // Move the sphere away from the camera in the z-direction if it's intersecting
        if(onWallCollision){
            for (const intersection of intersects) {
                if (toFind.includes(intersection.object)) {
                    toFind = removeFromArray( toFind, intersection.object )
                    scene.remove(intersection.object)
                    count = count + 1
                    score.innerText = `Score: ${count}/5`
                    successSound.currentTime = 0; 
                    successSound.play();
                }
            }
        }
    }) 
    
}


function animate() {
    requestAnimationFrame(animate)

    const time = performance.now() / 1000
    const dt = time - lastCallTime
    lastCallTime = time

    if (controls.enabled) {
        world.step(timeStep, dt)

        if( count == 5 ){
            controls.unlock()
            win.style.display = 'flex'
            winSound.play()
            audio.pause()
        }

        pointLight.position.copy( sphereBody.position )

        for(const object of objectsToUpdate)
        {
            object.mesh.position.copy(object.body.position)
            object.mesh.quaternion.copy(object.body.quaternion)
        }

        for(const object of findObjectsToUpdate)
        {
            object.mesh.position.copy(object.body.position)
            object.mesh.quaternion.copy(object.body.quaternion)
        }
    } 

    controls.update(dt)
    renderer.render(scene, camera)
}
