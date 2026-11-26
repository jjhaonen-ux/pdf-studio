import { describe, expect, it } from 'vitest';
import {
  clampNormalizedBox,
  getVisualPageDimensions,
  localPointToPdfPoint,
  visualBoxToPdfPlacement,
} from '../coordinates';

describe('coordinates conversion', () => {
  const mediaBox = { x: 0, y: 0, width: 400, height: 600 };
  const sampleBox = {
    xRatio: 0.1,
    yRatio: 0.2,
    widthRatio: 0.25,
    heightRatio: 0.1,
  };

  it('يحوّل الإحداثيات بشكل صحيح عند تدوير 0 درجة', () => {
    const res = visualBoxToPdfPlacement(sampleBox, mediaBox, 0);
    expect(res.rotateDegrees).toBe(0);
    expect(res.x).toBeCloseTo(40);
    expect(res.y).toBeCloseTo(420);
    expect(res.width).toBeCloseTo(100);
    expect(res.height).toBeCloseTo(60);
  });

  it('يحوّل الإحداثيات بشكل صحيح عند تدوير 90 درجة مع تبديل الأبعاد المرئية', () => {
    const dims = getVisualPageDimensions(400, 600, 90);
    expect(dims).toEqual({ visualWidth: 600, visualHeight: 400 });

    const res = visualBoxToPdfPlacement(sampleBox, mediaBox, 90);
    expect(res.rotateDegrees).toBe(90);
    expect(res.x).toBeCloseTo(120);
    expect(res.y).toBeCloseTo(60);
    expect(res.width).toBeCloseTo(150);
    expect(res.height).toBeCloseTo(40);

    // أعلى يسار الصندوق محلياً (0, height) -> (vy, vx) = (80, 60)
    const topLeft = localPointToPdfPoint(res, 0, res.height);
    expect(topLeft.x).toBeCloseTo(80);
    expect(topLeft.y).toBeCloseTo(60);
  });

  it('يحوّل الإحداثيات بشكل صحيح عند تدوير 180 درجة', () => {
    const res = visualBoxToPdfPlacement(sampleBox, mediaBox, 180);
    expect(res.rotateDegrees).toBe(180);
    expect(res.x).toBeCloseTo(360);
    expect(res.y).toBeCloseTo(180);

    const topRight = localPointToPdfPoint(res, res.width, res.height);
    expect(topRight.x).toBeCloseTo(260);
    expect(topRight.y).toBeCloseTo(120);
  });

  it('يحوّل الإحداثيات بشكل صحيح عند تدوير 270 درجة', () => {
    const res = visualBoxToPdfPlacement(sampleBox, mediaBox, 270);
    expect(res.rotateDegrees).toBe(270);
    expect(res.x).toBeCloseTo(280);
    expect(res.y).toBeCloseTo(540);

    const topLeft = localPointToPdfPoint(res, 0, res.height);
    expect(topLeft.x).toBeCloseTo(320);
    expect(topLeft.y).toBeCloseTo(540);
  });

  it('يقيّد الصندوق داخل حدود 0..1', () => {
    const clamped = clampNormalizedBox({
      xRatio: 0.9,
      yRatio: -0.2,
      widthRatio: 0.3,
      heightRatio: 0.2,
    });
    expect(clamped.xRatio).toBeCloseTo(0.7);
    expect(clamped.yRatio).toBe(0);
  });
});
