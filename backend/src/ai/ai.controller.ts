import { Controller, Post, Body } from '@nestjs/common';
import { AiService, AiResponse } from './ai.service';

export class AnalyzeUmlDto {
  userInput: string;
}

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('analyze-uml')
  async analyzeUml(@Body() body: any): Promise<AiResponse> {
    return this.aiService.analyzeUmlRequest(body.userInput);
  }
}
