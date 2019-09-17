import * as tf from '@tensorflow/tfjs-core';

import * as faceapi from '../src';
import { FaceRecognitionNet, IPoint, IRect, Mtcnn, TinyYolov2 } from '../src/';
import { AgeGenderNet } from '../src/ageGenderNet/AgeGenderNet';
import { FaceDetection } from '../src/classes/FaceDetection';
import { FaceLandmarks } from '../src/classes/FaceLandmarks';
import { FaceExpressionNet } from '../src/faceExpressionNet/FaceExpressionNet';
import { FaceLandmark68Net } from '../src/faceLandmarkNet/FaceLandmark68Net';
import { FaceLandmark68TinyNet } from '../src/faceLandmarkNet/FaceLandmark68TinyNet';
import { SsdMobilenetv1 } from '../src/ssdMobilenetv1/SsdMobilenetv1';
import { TinyFaceDetector } from '../src/tinyFaceDetector/TinyFaceDetector';
import { getTestEnv } from './env';

export function expectMaxDelta(val1: number, val2: number, maxDelta: number) {
  expect(Math.abs(val1 - val2)).toBeLessThanOrEqual(maxDelta)
}

export async function expectAllTensorsReleased(fn: () => any) {
  const numTensorsBefore = tf.memory().numTensors
  await fn()
  expect(tf.memory().numTensors - numTensorsBefore).toEqual(0)
}

export function pointDistance(pt1: IPoint, pt2: IPoint) {
  return Math.sqrt(Math.pow(pt1.x - pt2.x, 2) + Math.pow(pt1.y - pt2.y, 2))
}

export function expectPointClose(
  result: IPoint,
  expectedPoint: IPoint,
  maxDelta: number
) {
  expect(pointDistance(result, expectedPoint)).toBeLessThanOrEqual(maxDelta)
}

export function expectPointsClose(
  results: IPoint[],
  expectedPoints: IPoint[],
  maxDelta: number
) {
  expect(results.length).toEqual(expectedPoints.length)
  results.forEach((pt, j) => expectPointClose(pt, expectedPoints[j], maxDelta))
}

export function expectRectClose(
  result: IRect,
  expectedBox: IRect,
  maxDelta: number
) {
  expectPointClose(result, expectedBox, maxDelta)
  expectPointClose({ x: result.width, y: result.height }, { x:expectedBox.width, y: expectedBox.height }, maxDelta)
}

export function sortByDistanceToOrigin<T>(objs: T[], originGetter: (obj: T) => IPoint) {
  const origin = { x: 0, y: 0 }
  return objs.sort((obj1, obj2) =>
    pointDistance(originGetter(obj1), origin)
      - pointDistance(originGetter(obj2), origin)
  )
}

export function sortBoxes(boxes: IRect[]) {
  return sortByDistanceToOrigin(boxes, rect => rect)
}

export function sortFaceDetections(boxes: FaceDetection[]) {
  return sortByDistanceToOrigin(boxes, det => det.box)
}

export function sortLandmarks(landmarks: FaceLandmarks[]) {
  return sortByDistanceToOrigin(landmarks, l => l.positions[0])
}

export function sortByFaceBox<T extends { box: IRect }>(objs: T[]) {
  return sortByDistanceToOrigin(objs, o => o.box)
}

export function sortByFaceDetection<T extends { detection: FaceDetection }>(objs: T[]) {
  return sortByDistanceToOrigin(objs, d => d.detection.box)
}

export type ExpectedFaceDetectionWithLandmarks = {
  detection: IRect
  landmarks: IPoint[]
}

export type ExpectedFullFaceDescription = ExpectedFaceDetectionWithLandmarks & {
  descriptor: Float32Array
}

export async function assembleExpectedFullFaceDescriptions(
  detections: IRect[],
  landmarksFile: string = 'facesFaceLandmarkPositions.json'
): Promise<ExpectedFullFaceDescription[]> {
  const landmarks = await getTestEnv().loadJson<any[]>(`test/data/${landmarksFile}`)
  const descriptors = await getTestEnv().loadJson<any[]>('test/data/facesFaceDescriptors.json')

  return detections.map((detection, i) => ({
    detection,
    landmarks: landmarks[i],
    descriptor: descriptors[i]
  }))
}

export type WithNetOptions = {
  quantized?: boolean
}

export type WithTinyYolov2Options = WithNetOptions & {
  withSeparableConv?: boolean
}

export type InjectNetArgs = {
  ssdMobilenetv1: SsdMobilenetv1
  tinyFaceDetector: TinyFaceDetector
  faceLandmark68Net: FaceLandmark68Net
  faceLandmark68TinyNet: FaceLandmark68TinyNet
  faceRecognitionNet: FaceRecognitionNet
  mtcnn: Mtcnn
  faceExpressionNet: FaceExpressionNet
  ageGenderNet: AgeGenderNet
  tinyYolov2: TinyYolov2
}

export type DescribeWithNetsOptions = {
  withAllFacesSsdMobilenetv1?: boolean
  withAllFacesTinyFaceDetector?: boolean
  withAllFacesTinyYolov2?: boolean
  withAllFacesMtcnn?: boolean
  withSsdMobilenetv1?: WithNetOptions
  withTinyFaceDetector?: WithNetOptions
  withFaceLandmark68Net?: WithNetOptions
  withFaceLandmark68TinyNet?: WithNetOptions
  withFaceRecognitionNet?: WithNetOptions
  withMtcnn?: WithNetOptions
  withFaceExpressionNet?: WithNetOptions
  withAgeGenderNet?: WithNetOptions
  withTinyYolov2?: WithTinyYolov2Options
}

const gpgpu = tf.backend()['gpgpu']

if (gpgpu) {
  console.log('running tests on WebGL backend')
} else {
  console.log('running tests on CPU backend')
}

export function describeWithBackend(description: string, specDefinitions: () => void) {

  if (!(gpgpu instanceof tf.webgl.GPGPUContext)) {
    describe(description, specDefinitions)
    return
  }

  const defaultBackendName = tf.getBackend()
  const newBackendName = 'testBackend'
  const backend = new tf.webgl.MathBackendWebGL(gpgpu)

  describe(description, () => {
    beforeAll(() => {
      tf.registerBackend(newBackendName, () => backend)
      tf.setBackend(newBackendName)
    })

    afterAll(() => {
      tf.setBackend(defaultBackendName)
      tf.removeBackend(newBackendName)
      backend.dispose()
    })

    specDefinitions()
  })
}

export function describeWithNets(
  description: string,
  options: DescribeWithNetsOptions,
  specDefinitions: (nets: InjectNetArgs) => void
) {

  describe(description, () => {
    const {
      ssdMobilenetv1,
      tinyFaceDetector,
      faceLandmark68Net,
      faceLandmark68TinyNet,
      faceRecognitionNet,
      mtcnn,
      faceExpressionNet,
      ageGenderNet,
      tinyYolov2
    } = faceapi.nets

    beforeAll(async () => {
      const {
        withAllFacesSsdMobilenetv1,
        withAllFacesTinyFaceDetector,
        withAllFacesTinyYolov2,
        withAllFacesMtcnn,
        withSsdMobilenetv1,
        withTinyFaceDetector,
        withFaceLandmark68Net,
        withFaceLandmark68TinyNet,
        withFaceRecognitionNet,
        withMtcnn,
        withFaceExpressionNet,
        withAgeGenderNet,
        withTinyYolov2
      } = options

      if (withSsdMobilenetv1 || withAllFacesSsdMobilenetv1) {
        await getTestEnv().initNet<SsdMobilenetv1>(
          ssdMobilenetv1,
          !!withSsdMobilenetv1 && !withSsdMobilenetv1.quantized && 'ssd_mobilenetv1_model.weights'
        )
      }

      if (withTinyFaceDetector || withAllFacesTinyFaceDetector) {
        await getTestEnv().initNet<TinyFaceDetector>(
          tinyFaceDetector,
          !!withTinyFaceDetector && !withTinyFaceDetector.quantized && 'tiny_face_detector_model.weights'
        )
      }

      if (withFaceLandmark68Net || withAllFacesSsdMobilenetv1  || withAllFacesTinyFaceDetector|| withAllFacesMtcnn || withAllFacesTinyYolov2) {
        await getTestEnv().initNet<FaceLandmark68Net>(
          faceLandmark68Net,
          !!withFaceLandmark68Net && !withFaceLandmark68Net.quantized && 'face_landmark_68_model.weights'
        )
      }

      if (withFaceLandmark68TinyNet) {
        await getTestEnv().initNet<FaceLandmark68TinyNet>(
          faceLandmark68TinyNet,
          !!withFaceLandmark68TinyNet && !withFaceLandmark68TinyNet.quantized && 'face_landmark_68_tiny_model.weights'
        )
      }

      if (withFaceRecognitionNet || withAllFacesSsdMobilenetv1  || withAllFacesTinyFaceDetector|| withAllFacesMtcnn || withAllFacesTinyYolov2) {
        await getTestEnv().initNet<FaceRecognitionNet>(
          faceRecognitionNet,
          !!withFaceRecognitionNet && !withFaceRecognitionNet.quantized && 'face_recognition_model.weights'
        )
      }

      if (withMtcnn || withAllFacesMtcnn) {
        await getTestEnv().initNet<Mtcnn>(
          mtcnn,
          !!withMtcnn && !withMtcnn.quantized && 'mtcnn_model.weights'
        )
      }

      if (withFaceExpressionNet) {
        await getTestEnv().initNet<FaceExpressionNet>(
          faceExpressionNet,
          !!withFaceExpressionNet && !withFaceExpressionNet.quantized && 'face_expression_model.weights'
        )
      }

      if (withAgeGenderNet) {
        await getTestEnv().initNet<AgeGenderNet>(
          ageGenderNet,
          !!withAgeGenderNet && !withAgeGenderNet.quantized && 'age_gender_model.weights'
        )
      }

      if (withTinyYolov2 || withAllFacesTinyYolov2) {
        await getTestEnv().initNet<TinyYolov2>(
          tinyYolov2,
          !!withTinyYolov2 && !withTinyYolov2.quantized && 'tiny_yolov2_model.weights',
          true
        )
      }


    })

    afterAll(() => {
      ssdMobilenetv1.isLoaded && ssdMobilenetv1.dispose()
      faceLandmark68Net.isLoaded && faceLandmark68Net.dispose()
      faceRecognitionNet.isLoaded && faceRecognitionNet.dispose()
      mtcnn.isLoaded && mtcnn.dispose()
      tinyFaceDetector.isLoaded && tinyFaceDetector.dispose()
      tinyYolov2.isLoaded && tinyYolov2.dispose()
      faceExpressionNet.isLoaded && faceExpressionNet.dispose()
    })

    specDefinitions({
      ssdMobilenetv1,
      tinyFaceDetector,
      faceLandmark68Net,
      faceLandmark68TinyNet,
      faceRecognitionNet,
      mtcnn,
      faceExpressionNet,
      ageGenderNet,
      tinyYolov2
    })
  })
}

