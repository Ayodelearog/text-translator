import { NextRequest, NextResponse } from "next/server";
import { TranslationServiceClient } from "@google-cloud/translate";

export async function POST(req: NextRequest) {
  try {
    const { text, targetLanguage, sourceLanguage = "en" } = await req.json();

    console.log("Received text:", text);
    console.log("Target language:", targetLanguage);

    if (!text || !targetLanguage) {
      return NextResponse.json(
        { message: "Both 'text' and 'targetLanguage' are required." },
        { status: 400 }
      );
    }

    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (!credentials || !projectId) {
      return NextResponse.json(
        { message: "Missing Google Cloud configuration." },
        { status: 500 }
      );
    }

    const translationClient = new TranslationServiceClient();
    const request = {
      parent: `projects/${projectId}/locations/global`,
      contents: [text],
      mimeType: "text/plain",
      sourceLanguageCode: sourceLanguage,
      targetLanguageCode: targetLanguage,
    };

    const [response] = await translationClient.translateText(request);

    const translatedText = response.translations[0]?.translatedText || "";
    if (!translatedText) {
      return NextResponse.json(
        { message: "Translation API returned an empty response." },
        { status: 500 }
      );
    }

    return NextResponse.json({ translatedText });
  } catch (error: unknown) {
    if (error instanceof Error) {

      console.error("Error in translation API:", error);
      return NextResponse.json(
        { message: "Error translating text", error: error.message },
        { status: 500 }
      );
    }
  }
}
