# Atrapa la pasta

**Atrapa la pasta** es una web para organizar una partida familiar inspirada en el formato de *Atrapa un millón* / *Caza un millón*, adaptada para niños.

La aplicación no gestiona dinero real ni premios dentro de la pantalla. Su función es servir como apoyo visual para el presentador: muestra rondas, temas, opciones, preguntas, cronómetro, comodines y revelación de respuestas. La gestión del dinero, fichas, billetes o premio se hace físicamente fuera de la web.

## Cómo funciona el juego

Los participantes empiezan con una cantidad simbólica de dinero o fichas, normalmente **1.000.000**. En cada ronda deben colocar ese dinero sobre una o varias respuestas antes de que termine el tiempo.

La dinámica básica de cada ronda es:

1. El presentador muestra las cuatro opciones de respuesta.
2. Después revela la pregunta.
3. Los jugadores tienen un tiempo limitado para repartir su dinero.
4. Deben dejar al menos una opción vacía.
5. Al terminar la deliberación, el presentador revela las respuestas.
6. El dinero colocado en respuestas incorrectas se pierde.
7. Solo continúa en juego el dinero que estuviera sobre la respuesta correcta.

Si los jugadores pierden todo el dinero, la partida termina. Si llegan a la última ronda, ganan la cantidad que hayan conseguido conservar.

## Papel de la web

La web está pensada para que la controle una persona que actúa como presentador. Desde la pantalla puede:

- Cargar un fichero de preguntas en formato JSON.
- Avanzar por las rondas de la partida.
- Mostrar las opciones una a una antes de enseñar la pregunta.
- Iniciar, pausar y finalizar el cronómetro.
- Revelar respuestas incorrectas y correctas.
- Gestionar rondas donde los jugadores eligen entre dos temas.
- Activar comodines cuando estén disponibles.
- Usar efectos visuales y sonidos para dar ritmo al juego.

La pantalla no sabe cuánto dinero queda ni dónde lo han colocado los jugadores. Esa parte se lleva con billetes, fichas, tarjetas o cualquier otro material físico.

## Rondas y dificultad

La partida se compone de una lista de rondas definida en `preguntas.json`. El fichero incluido contiene 15 rondas de ejemplo con preguntas sencillas y temáticas pensadas para niños.

El formato permite dos tipos de ronda:

- `normal`: se muestra una pregunta de un tema concreto.
- `eleccion`: los jugadores eligen entre dos temáticas antes de jugar la ronda.

En la versión de ejemplo hay rondas de elección en distintos momentos de la partida, para imitar el ritmo del concurso original y dar más participación a los niños.

## Comodines

Los comodines se desbloquean después de superar la ronda 3. Cada comodín solo puede usarse una vez por partida y la web permite utilizar como máximo un comodín por ronda.

Comodines disponibles:

- **50%**: elimina dos respuestas falsas.
- **Llamada**: pausa el tiempo para que los jugadores puedan pedir ayuda.
- **Pista**: muestra una ayuda asociada a la pregunta actual.

Los comodines solo se pueden activar mientras el cronómetro está corriendo.

## Controles del presentador

La interfaz incluye botones laterales para dirigir la partida:

- **Avanzar**: muestra opciones, enseña la pregunta o pasa a la siguiente fase.
- **Iniciar/Pausar tiempo**: controla el cronómetro de deliberación.
- **Finalizar deliberación**: detiene el tiempo y permite revelar respuestas.
- **Siguiente ronda**: prepara la siguiente pregunta cuando la actual ya está resuelta.

También hay atajos de teclado:

- `Espacio`: avanzar.
- `T`: iniciar, pausar o reanudar el tiempo.
- `F`: finalizar la deliberación.
- `1` a `4`: revelar una respuesta.
- `N`: pasar a la siguiente ronda.

## Cómo ejecutar la web

Es una web estática formada por HTML, CSS, JavaScript y un fichero JSON de preguntas. No necesita instalación de dependencias.

La forma más cómoda de abrirla es servir la carpeta con un servidor local. Por ejemplo:

```bash
python3 -m http.server 8000
```

Después abre en el navegador:

```text
http://localhost:8000
```

Al cargar, la web intentará leer automáticamente `preguntas.json`. Si el navegador bloquea esa carga, puedes seleccionar manualmente el archivo desde la pantalla inicial o usar las preguntas de ejemplo.

## Formato de preguntas

Las preguntas se definen en `preguntas.json` dentro de una propiedad `rondas`.

Ejemplo de ronda normal:

```json
{
  "tipo": "normal",
  "tema": "Animales",
  "pregunta": "¿Qué animal es conocido como el rey de la selva?",
  "opciones": ["Tigre", "León", "Elefante", "Gorila"],
  "correcta": 1,
  "pista": "Tiene melena y ruge muy fuerte."
}
```

Ejemplo de ronda con elección de tema:

```json
{
  "tipo": "eleccion",
  "temas": [
    {
      "tema": "Minecraft",
      "pregunta": "¿Qué material se usa para construir un portal al Nether?",
      "opciones": ["Hierro", "Obsidiana", "Diamante", "Arena"],
      "correcta": 1,
      "pista": "Es un bloque negro muy resistente."
    },
    {
      "tema": "Fútbol",
      "pregunta": "¿Cuánto dura un partido de fútbol profesional sin contar el descuento?",
      "opciones": ["60 minutos", "80 minutos", "90 minutos", "120 minutos"],
      "correcta": 2,
      "pista": "Son dos partes iguales."
    }
  ]
}
```

Notas importantes:

- Cada pregunta debe tener exactamente cuatro opciones.
- `correcta` es el índice de la respuesta correcta, empezando en `0`.
- `pista` se usa cuando el presentador activa el comodín de pista.
- En rondas `eleccion`, cada tema contiene una pregunta completa.

## Consejos para preparar una partida

- Usa billetes de juguete, fichas o tarjetas para representar el dinero.
- Ajusta las preguntas a la edad de los niños.
- Mezcla temas escolares con temas divertidos: videojuegos, animales, deportes, cine, música o comida.
- Recuerda a los jugadores que siempre deben dejar una respuesta sin dinero.
- Deja que el presentador controle el ritmo: puede crear tensión pausando, revelando respuestas incorrectas primero o usando las rondas de elección para hacer participar al grupo.

## Estructura del proyecto

```text
.
├── index.html       # Estructura de la interfaz
├── styles.css       # Diseño visual del juego
├── app.js           # Lógica de rondas, tiempo, comodines y respuestas
├── preguntas.json   # Banco de preguntas de la partida
└── README.md        # Documentación del proyecto
```
