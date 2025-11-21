import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { SecuGenService } from '../services/secugen.service';
import {
  base64ToArrayBuffer,
  drawImageOnCanvas,
  scaleImageFast,
  enhanceContrast,
  getImageStats,
} from '../services/image-utils';

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  standalone: false,
})
export class Tab3Page implements OnInit {
  @ViewChild('originalCanvas') originalCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('scaledCanvas') scaledCanvas!: ElementRef<HTMLCanvasElement>;

  lastCapture: any;
  imageStats: any;
  isEnhanced = false;

  constructor(private secugenService: SecuGenService) {}

  ngOnInit() {
    // Subscribe to capture complete events
    this.secugenService.captureComplete$.subscribe((result: any) => {
      console.log('✅ Tab3: Capture complete:', result);
      this.lastCapture = result;
      this.isEnhanced = false;

      // Display image
      this.displayCaptureImage(result);

      // Get image statistics
      try {
        this.imageStats = this.secugenService.getImageQualityStats(result);
        console.log('📊 Image stats:', this.imageStats);
      } catch (error) {
        console.error('Error getting stats:', error);
      }
    });
  }

  /**
   * Display captured raw image on canvas with scaling
   */
  displayCaptureImage(captureResult: any) {
    if (!this.originalCanvas || !this.scaledCanvas) {
      console.warn('Canvas refs not ready');
      return;
    }

    const canvas = this.originalCanvas.nativeElement;
    const scaledCanvas = this.scaledCanvas.nativeElement;

    try {
      // Convert base64 to raw buffer
      const rawBuffer = new Uint8Array(base64ToArrayBuffer(captureResult.imageData));
      const width = captureResult.width;
      const height = captureResult.height;

      // Display original on first canvas
      drawImageOnCanvas(canvas, rawBuffer, width, height);
      console.log(`✅ Tab3: Displayed ${width}x${height} image`);

      // Display scaled version (100x150) on second canvas
      const scaledImageData = scaleImageFast(width, height, rawBuffer, 100, 150);
      scaledCanvas.width = 100;
      scaledCanvas.height = 150;
      const ctx = scaledCanvas.getContext('2d');
      if (ctx) {
        ctx.putImageData(scaledImageData, 0, 0);
        console.log('✅ Tab3: Displayed scaled 100x150 image');
      }
    } catch (error) {
      console.error('Tab3: Error displaying image:', error);
    }
  }

  /**
   * Enhance image contrast and redisplay
   */
  enhanceImageContrast() {
    if (!this.lastCapture) {
      console.warn('No capture result');
      return;
    }

    try {
      const rawBuffer = new Uint8Array(base64ToArrayBuffer(this.lastCapture.imageData));
      const enhanced = enhanceContrast(rawBuffer);

      const canvas = this.originalCanvas.nativeElement;
      drawImageOnCanvas(canvas, enhanced, this.lastCapture.width, this.lastCapture.height);
      console.log('✅ Tab3: Image contrast enhanced');
      this.isEnhanced = true;
    } catch (error) {
      console.error('Tab3: Error enhancing contrast:', error);
    }
  }

  /**
   * Reset enhancement
   */
  resetEnhancement() {
    if (this.lastCapture) {
      this.displayCaptureImage(this.lastCapture);
      this.isEnhanced = false;
    }
  }
}
