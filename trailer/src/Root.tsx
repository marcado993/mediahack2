import React from "react";
import { Composition } from "remotion";
import { Trailer, DURACION, DURACION_CANCION } from "./Trailer";

export const Root: React.FC = () => (
  <>
    {/* the one to publish: original music */}
    <Composition id="Trailer" component={Trailer} durationInFrames={DURACION} fps={30} width={1920} height={1080} defaultProps={{ cancion: false, control: false }} />
    {/* private demo, cut to a song placed in public/cancion-demo.wav (see musica/analizar.py, musica/instrumentos.py) */}
    <Composition id="TrailerCancion" component={Trailer} durationInFrames={DURACION_CANCION} fps={30} width={1920} height={1080} defaultProps={{ cancion: true, control: false }} />
    {/* review only: the song demo with a strip marking every instrument event */}
    <Composition id="TrailerControl" component={Trailer} durationInFrames={DURACION_CANCION} fps={30} width={1920} height={1080} defaultProps={{ cancion: true, control: true }} />
  </>
);
