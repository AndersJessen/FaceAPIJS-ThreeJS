import * as faceapi from '../../../src';
import { describeWithNets, expectAllTensorsReleased, assembleExpectedFullFaceDescriptions, ExpectedFullFaceDescription, describeWithBackend } from '../../utils';
import { TinyFaceDetectorOptions } from '../../../src';
import { expectFaceDetections } from '../../expectFaceDetections';
import { expectFullFaceDescriptions } from '../../expectFullFaceDescriptions';
import { expectFaceDetectionsWithLandmarks } from '../../expectFaceDetectionsWithLandmarks';
import { expectedTinyFaceDetectorBoxes } from '../../expectedTinyFaceDetectorBoxes';
import { getTestEnv } from '../../env';

describeWithBackend('tinyFaceDetector', () => {

  let imgEl: HTMLImageElement
  let expectedFullFaceDescriptions: ExpectedFullFaceDescription[]
  const expectedScores = [0.7, 0.82, 0.93, 0.86, 0.79, 0.84]
  const deltas = {
    maxScoreDelta: 0.05,
    maxBoxDelta: 5,
    maxLandmarksDelta: 10,
    maxDescriptorDelta: 0.2
  }

  beforeAll(async () => {
    imgEl = await getTestEnv().loadImage('test/images/faces.jpg')
    expectedFullFaceDescriptions = await assembleExpectedFullFaceDescriptions(expectedTinyFaceDetectorBoxes)
  })

  describeWithNets('tinyFaceDetector', { withAllFacesTinyFaceDetector: true, withFaceExpressionNet: { quantized: true } }, () => {

    describe('detectAllFaces', () => {

      it('detectAllFaces', async () => {
        const options = new TinyFaceDetectorOptions({
          inputSize: 416
        })

        const results = await faceapi.detectAllFaces(imgEl, options)

        expect(results.length).toEqual(6)
        expectFaceDetections(results, expectedTinyFaceDetectorBoxes, expectedScores, deltas.maxScoreDelta, deltas.maxBoxDelta)
      })

      it('detectAllFaces.withFaceLandmarks()', async () => {
        const options = new TinyFaceDetectorOptions({
          inputSize: 416
        })

        const results = await faceapi
          .detectAllFaces(imgEl, options)
          .withFaceLandmarks()

        expect(results.length).toEqual(6)
        expectFaceDetectionsWithLandmarks(results, expectedFullFaceDescriptions, expectedScores, deltas)
      })

      it('detectAllFaces.withFaceLandmarks().withFaceDescriptors()', async () => {
        const options = new TinyFaceDetectorOptions({
          inputSize: 416
        })

        const results = await faceapi
          .detectAllFaces(imgEl, options)
          .withFaceLandmarks()
          .withFaceDescriptors()

        expect(results.length).toEqual(6)
        expectFullFaceDescriptions(results, expectedFullFaceDescriptions, expectedScores, deltas)
      })

    })

    describe('detectSingleFace', () => {

      it('detectSingleFace', async () => {
        const options = new TinyFaceDetectorOptions({
          inputSize: 416
        })

        const result = await faceapi
          .detectSingleFace(imgEl, options)

        expect(!!result).toBeTruthy()
        expectFaceDetections(
          result ? [result] : [],
          [expectedTinyFaceDetectorBoxes[2]],
          [expectedScores[2]],
          deltas.maxScoreDelta,
          deltas.maxBoxDelta
        )
      })

      it('detectSingleFace.withFaceLandmarks()', async () => {
        const options = new TinyFaceDetectorOptions({
          inputSize: 416
        })

        const result = await faceapi
          .detectSingleFace(imgEl, options)
          .withFaceLandmarks()

        expect(!!result).toBeTruthy()
        expectFaceDetectionsWithLandmarks(
          result ? [result] : [],
          [expectedFullFaceDescriptions[2]],
          [expectedScores[2]],
          deltas
        )
      })

      it('detectSingleFace.withFaceLandmarks().withFaceDescriptor()', async () => {
        const options = new TinyFaceDetectorOptions({
          inputSize: 416
        })

        const result = await faceapi
          .detectSingleFace(imgEl, options)
          .withFaceLandmarks()
          .withFaceDescriptor()

        expect(!!result).toBeTruthy()
        expectFullFaceDescriptions(
          result ? [result] : [],
          [expectedFullFaceDescriptions[2]],
          [expectedScores[2]],
          deltas
        )
      })

    })

    describe('no memory leaks', () => {

      it('detectAllFaces', async () => {
        await expectAllTensorsReleased(async () => {
          await faceapi
            .detectAllFaces(imgEl, new TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptors()
        })
      })

      it('detectSingleFace', async () => {
        await expectAllTensorsReleased(async () => {
          await faceapi
            .detectSingleFace(imgEl, new TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor()
        })
      })

    })

  })

})