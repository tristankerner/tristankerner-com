export interface MemorySlideImage {
  src: string;
  alt: string;
}

export interface MemorySlide {
  text: string;
  image?: MemorySlideImage;
}
