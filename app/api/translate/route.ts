import { NextResponse } from 'next/server';
import { TranslationServiceClient } from '@google-cloud/translate';

// Initialize the Translation client
const translationClient = new TranslationServiceClient();

export async function POST(req: Request) {
  try {
    const { text, targetLanguage } = await req.json();

    if (!text || !targetLanguage) {
      return NextResponse.json(
        { message: "Both text and targetLanguage are required." },
        { status: 400 }
      );
    }

    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const location = 'global';

    if (!projectId) {
      return NextResponse.json(
        { message: "Google Cloud Project ID is not configured." },
        { status: 500 }
      );
    }

    const request = {
      parent: `projects/${projectId}/locations/${location}`,
      contents: [text],
      mimeType: 'text/plain',
      targetLanguageCode: targetLanguage,
    };

    const [response] = await translationClient.translateText(request);

    if (!response || !response.translations || response.translations.length === 0) {
      return NextResponse.json(
        { message: "Translation API returned an empty response." },
        { status: 500 }
      );
    }

    const translatedText = response.translations[0]?.translatedText;

    if (!translatedText) {
      return NextResponse.json(
        { message: "Translated text is empty." },
        { status: 500 }
      );
    }

    return NextResponse.json({ translatedText });
  } catch (error) {
    console.error('Translation error:', error);
    return NextResponse.json(
      { message: "An error occurred during translation." },
      { status: 500 }
    );
  }
}