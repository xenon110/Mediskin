
'use client';

import React from 'react';
import Image from 'next/image';
import { Card, CardContent } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { placeholderImages } from '@/lib/placeholder-images';
import Autoplay from "embla-carousel-autoplay";

const sliderImageIds = [
  'slider-1', 'slider-2', 'slider-3', 'slider-4', 
  'slider-5', 'slider-6', 'slider-7', 'slider-8'
];

const sliderImages = placeholderImages.filter(img => sliderImageIds.includes(img.id));

const ImageSlider = () => {
  const plugin = React.useRef(
    Autoplay({ delay: 2000, stopOnInteraction: true })
  );

  return (
    <section className="image-slider-section">
      <Carousel 
        plugins={[plugin.current]}
        className="w-full"
        onMouseEnter={plugin.current.stop}
        onMouseLeave={plugin.current.reset}
        opts={{
          align: "start",
          loop: true,
        }}
      >
        <CarouselContent>
          {sliderImages.map((image) => (
            <CarouselItem key={image.id} className="md:basis-1/2 lg:basis-1/3">
              <div className="p-1">
                <Card className="overflow-hidden rounded-xl">
                  <CardContent className="flex aspect-video items-center justify-center p-0">
                    <Image 
                      src={image.imageUrl} 
                      alt={image.description} 
                      width={800} 
                      height={600} 
                      className="w-full h-full object-cover"
                      data-ai-hint={image.imageHint}
                    />
                  </CardContent>
                </Card>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </section>
  );
};

export default ImageSlider;
