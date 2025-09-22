import { Injectable } from '@nestjs/common';
import Groq from 'groq-sdk';

export interface UmlSuggestion {
  classes?: Array<{
    name: string;
    attributes: string[];
    methods: string[];
  }>;
  relations?: Array<{
    from: string;
    to: string;
    type: string;
  }>;
}

export interface AiResponse {
  content: string;
  suggestions?: UmlSuggestion;
}

@Injectable()
export class AiService {
  private groq: Groq;

  constructor() {
    // Inicializar Groq con la API key desde variables de entorno
    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY || 'gsk_your_api_key_here',
    });
  }

  async analyzeUmlRequest(userInput: string): Promise<AiResponse> {
    try {
      const systemPrompt = `Eres un experto en diseño de software y diagramas UML. 
      Tu tarea es analizar descripciones de sistemas y generar sugerencias para diagramas de clases UML.

      Responde SIEMPRE en formato JSON con esta estructura exacta:
      {
        "content": "Explicación del análisis en español",
        "suggestions": {
          "classes": [
            {
              "name": "NombreClase",
              "attributes": ["String nombre", "Integer edad"],
              "methods": ["metodo1()", "metodo2()"]
            }
          ],
          "relations": [
            {
              "from": "ClaseA",
              "to": "ClaseB", 
              "type": "ONE_TO_MANY"
            }
          ]
        }
      }

      Tipos de relaciones válidos: ONE_TO_ONE, ONE_TO_MANY, MANY_TO_ONE, MANY_TO_MANY, ASSOCIATION, INHERITANCE, COMPOSITION, AGGREGATION

      Si no hay sugerencias claras, responde solo con "content" explicando qué más información necesitas.`;

      const completion = await this.groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userInput,
          },
        ],
        model: 'llama-3.1-8b-instant', // Modelo actualizado y gratuito de Groq
        temperature: 0.7,
        max_tokens: 1000,
      });

      const response = completion.choices[0]?.message?.content;
      
      if (!response) {
        throw new Error('No response from AI');
      }

      // Intentar parsear la respuesta JSON
      try {
        const parsedResponse = JSON.parse(response);
        return parsedResponse;
      } catch (parseError) {
        // Si no es JSON válido, devolver como texto plano
        return {
          content: response,
        };
      }
    } catch (error) {
      console.error('Error calling Groq API:', error);
      
      // Fallback: respuesta simulada para desarrollo
      return this.getFallbackResponse(userInput);
    }
  }

  private getFallbackResponse(userInput: string): AiResponse {
    const lowerInput = userInput.toLowerCase();
    
    if (lowerInput.includes('biblioteca') || lowerInput.includes('library')) {
      return {
        content: 'Perfecto! Para un sistema de biblioteca, te sugiero estas clases principales:',
        suggestions: {
          classes: [
            {
              name: 'Usuario',
              attributes: ['String nombre', 'String email', 'Date fechaRegistro'],
              methods: ['prestarLibro()', 'devolverLibro()', 'consultarHistorial()']
            },
            {
              name: 'Libro',
              attributes: ['String titulo', 'String autor', 'String isbn', 'Boolean disponible'],
              methods: ['marcarDisponible()', 'marcarPrestado()', 'obtenerInformacion()']
            },
            {
              name: 'Prestamo',
              attributes: ['Date fechaPrestamo', 'Date fechaVencimiento', 'Boolean devuelto'],
              methods: ['calcularMulta()', 'marcarDevuelto()', 'extenderPrestamo()']
            }
          ],
          relations: [
            { from: 'Usuario', to: 'Prestamo', type: 'ONE_TO_MANY' },
            { from: 'Libro', to: 'Prestamo', type: 'ONE_TO_MANY' }
          ]
        }
      };
    }
    
    if (lowerInput.includes('tienda') || lowerInput.includes('ecommerce')) {
      return {
        content: 'Excelente! Para un sistema de e-commerce, estas son las clases que recomiendo:',
        suggestions: {
          classes: [
            {
              name: 'Cliente',
              attributes: ['String nombre', 'String email', 'String direccion'],
              methods: ['realizarCompra()', 'consultarPedidos()', 'actualizarPerfil()']
            },
            {
              name: 'Producto',
              attributes: ['String nombre', 'Double precio', 'Integer stock', 'String categoria'],
              methods: ['actualizarStock()', 'calcularDescuento()', 'obtenerDetalles()']
            },
            {
              name: 'Pedido',
              attributes: ['Date fechaPedido', 'Double total', 'String estado'],
              methods: ['calcularTotal()', 'actualizarEstado()', 'generarFactura()']
            }
          ],
          relations: [
            { from: 'Cliente', to: 'Pedido', type: 'ONE_TO_MANY' },
            { from: 'Producto', to: 'Pedido', type: 'MANY_TO_MANY' }
          ]
        }
      };
    }

    return {
      content: 'Interesante! Para ayudarte mejor, podrías describir más detalles sobre:\n\n• ¿Qué tipo de sistema es?\n• ¿Cuáles son las entidades principales?\n• ¿Qué funcionalidades necesita?\n\nEjemplos: "Sistema de biblioteca", "E-commerce", "Gestión de empleados", etc.'
    };
  }
}
