import { NextResponse } from 'next/server';
import { TranslationServiceClient } from '@google-cloud/translate';

const translationClient = new TranslationServiceClient();

export async function POST(req: Request) {
  try {
    const { text, targetLanguage } = await req.json();
    console.log('Received request:', { text, targetLanguage });

    if (!text || !targetLanguage) {
      console.error('Missing required fields');
      return NextResponse.json(
        { message: "Both text and targetLanguage are required." },
        { status: 400 }
      );
    }

    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    console.log('Project ID:', projectId);

    if (!projectId) {
      console.error('Google Cloud Project ID is not configured');
      return NextResponse.json(
        { message: "Google Cloud Project ID is not configured." },
        { status: 500 }
      );
    }

    const request = {
      parent: `projects/${projectId}/locations/global`,
      contents: [text],
      mimeType: 'text/plain',
      targetLanguageCode: targetLanguage,
    };
    console.log('Translation request:', request);

    const [response] = await translationClient.translateText(request);
    console.log('Translation response:', JSON.stringify(response, null, 2));

    if (!response || !response.translations || response.translations.length === 0) {
      console.error('Translation API returned an empty response');
      return NextResponse.json(
        { message: "Translation API returned an empty response." },
        { status: 500 }
      );
    }

    const translatedText = response.translations[0]?.translatedText;

    if (!translatedText) {
      console.error('Translated text is empty');
      return NextResponse.json(
        { message: "Translated text is empty." },
        { status: 500 }
      );
    }

    console.log('Successfully translated text');
    return NextResponse.json({ translatedText });
  } catch (error) {
    console.error('Translation error:', error);
    return NextResponse.json(
      { message: "An error occurred during translation.", error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}