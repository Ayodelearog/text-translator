"use client";
import React, { useState, useRef } from "react";
import { v4 as uuidv4 } from "uuid";

interface TranslationResponse {
	translatedText: string;
}

interface Change {
  original: string;
  translated: string;
  bold: boolean;
  italic: boolean;
  link: string;
}

interface TranslationItem {
  key: string;
  original: string;
  translated: string;
  changes?: Change[];
}

type NestedJson = {
  [key: string]: string | TranslationItem | NestedJson | NestedJson[];
};

export async function translateText(
	text: string,
	targetLanguage: string
): Promise<string> {
	if (!text || !targetLanguage) {
		console.error("Invalid parameters passed to translateText:", {
			text,
			targetLanguage,
		});
		throw new Error("Both text and targetLanguage are required.");
	}

	try {
		const response = await fetch("/api/translate", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ text, targetLanguage }),
		});

		if (!response.ok) {
			const errorData = await response.json();
			console.error(
				`API responded with status ${response.status}: ${errorData.message}`
			);
			throw new Error(`Translation failed: ${errorData.message}`);
		}

		const data: TranslationResponse = await response.json();
		return data.translatedText;

	} catch (error: unknown) {
		// if (error instanceof Error) {
		// 	console.error("Error in translateText:", error.message || error);
		// }
    // throw error;
    console.error("Error in translateText:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unexpected error occurred during translation');
  // }
	}
}

export default function TranslationSystem() {
	const [inputJson, setInputJson] = useState<string>("");
	const [outputJson, setOutputJson] = useState<string>("");
	const [targetLanguage, setTargetLanguage] = useState<string>("es");
	const [error, setError] = useState<string | null>(null);
	const [isProcessing, setIsProcessing] = useState<boolean>(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) {
			setError("No file selected");
			return;
		}

		if (file.type !== "application/json") {
			setError("Please upload a JSON file");
			return;
		}

		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const content = e.target?.result as string;
				JSON.parse(content); // Validate JSON
				setInputJson(content);
				setError(null);
			} catch (err) {
				setError("Invalid JSON file");
				setInputJson("");
				console.log(err);
			}
		};
		reader.onerror = () => {
			setError("Error reading file");
			setInputJson("");
		};
		reader.readAsText(file);
	};

	const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
		event.preventDefault();
	};

	const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		const file = event.dataTransfer.files[0];
		if (file && file.type === "application/json") {
			if (fileInputRef.current) {
				fileInputRef.current.files = event.dataTransfer.files;
				handleFileUpload({
					target: { files: event.dataTransfer.files },
				} as React.ChangeEvent<HTMLInputElement>);
			}
		} else {
			setError("Please drop a JSON file");
		}
	};

	const translateNestedJson = async (
		data: NestedJson,
		targetLanguage: string
	): Promise<NestedJson> => {
		const translatedData: NestedJson = {};

		for (const [key, value] of Object.entries(data)) {
			try {
				if (key === "original") {
					// Preserve the original text
					translatedData[key] = value;
					continue;
				}

				if (key === "translated" && typeof value === "string") {
					// Translate only the "translated" field
					const processedText = preprocessText(value);
					if (processedText.text) {
						const translatedText = await translateText(
							processedText.text,
							targetLanguage
						);
						translatedData[key] = postprocessText(
							translatedText,
							processedText.placeholders
						);
					} else {
						translatedData[key] = value; // Preserve untranslated text
					}
					continue;
				}

				if (Array.isArray(value)) {
					translatedData[key] = await Promise.all(
						value.map(async (item) => {
							if (typeof item === "object" && item !== null) {
								return await translateNestedJson(item, targetLanguage);
							}
							return item;
						})
					);
				} else if (typeof value === "object" && value !== null) {
					translatedData[key] = await translateNestedJson(
						value as NestedJson,
						targetLanguage
					);
				} else {
					translatedData[key] = value; // Copy other types as-is
				}
			} catch (error) {
				console.error(`Error translating key: ${key}`, error);
				translatedData[key] = value; // Preserve original value on error
			}
		}

		return translatedData;
	};

	const processTranslations = async () => {
		setIsProcessing(true);
		setError(null);

		try {
			const data = JSON.parse(inputJson);
			const translatedData = await translateNestedJson(data, targetLanguage);

			setOutputJson(JSON.stringify(translatedData, null, 2));
		} catch (error: unknown) {
			if (error instanceof Error) {
				console.error("Error processing translations:", error);
				setError(`Error processing translations: ${error.message}`);
				setOutputJson("");
			}
		} finally {
			setIsProcessing(false);
		}
	};

	const preprocessText = (text: string) => {
		const placeholders: Record<string, string> = {};
		let processedText = text;

		// Replace bold text
		processedText = processedText.replace(/<b>(.*?)<\/b>/g, (_, content) => {
			const id = uuidv4();
			placeholders[id] = `<b>${content}</b>`;
			return `{{${id}}}`;
		});

		// Replace italic text
		processedText = processedText.replace(/<i>(.*?)<\/i>/g, (_, content) => {
			const id = uuidv4();
			placeholders[id] = `<i>${content}</i>`;
			return `{{${id}}}`;
		});

		// Replace links
		processedText = processedText.replace(
			/<a href="(.*?)">(.*?)<\/a>/g,
			(_, href, content) => {
				const id = uuidv4();
				placeholders[id] = `<a href="${href}">${content}</a>`;
				return `{{${id}}}`;
			}
		);

		// Replace variable placeholders
		processedText = processedText.replace(/\${(.*?)}/g, (_, content) => {
			const id = uuidv4();
			placeholders[id] = `\${${content}}`;
			return `{{${id}}}`;
		});

		return { text: processedText, placeholders };
	};

	const postprocessText = (
		text: string,
		placeholders: Record<string, string>
	) => {
		let processedText = text;
		for (const [id, content] of Object.entries(placeholders)) {
			processedText = processedText.replace(`{{${id}}}`, content);
		}
		return processedText;
	};

	return (
		<div className="p-4 max-w-4xl mx-auto">
			<h1 className="text-3xl font-bold mb-6">Translation System</h1>

			<div className="mb-6">
				<h2 className="text-xl font-semibold mb-2">1. Upload JSON File</h2>
				<div
					className="border-2 border-dashed border-gray-300 rounded-lg p-8 mb-4 text-center cursor-pointer"
					onDragOver={handleDragOver}
					onDrop={handleDrop}
					onClick={() => fileInputRef.current?.click()}
				>
					<input
						type="file"
						accept=".json"
						onChange={handleFileUpload}
						className="hidden"
						ref={fileInputRef}
					/>
					<p>Click to upload or drag and drop a JSON file here</p>
				</div>
				{error && <p className="text-red-500 mb-4">{error}</p>}
			</div>

			<div className="mb-6">
				<h2 className="text-xl font-semibold mb-2">
					2. Select Target Language
				</h2>
				<select
					value={targetLanguage}
					onChange={(e) => setTargetLanguage(e.target.value)}
					className="w-full p-2 border rounded"
				>
					<option value="es">Spanish</option>
					<option value="fr">French</option>
					<option value="de">German</option>
				</select>
			</div>

			<div className="mb-6">
				<h2 className="text-xl font-semibold mb-2">3. Input JSON</h2>
				<textarea
					value={inputJson}
					onChange={(e) => setInputJson(e.target.value)}
					className="w-full h-60 p-2 border rounded font-mono"
					placeholder="Your JSON will appear here after upload, or you can paste it manually"
				/>
			</div>

			<button
				onClick={processTranslations}
				disabled={!inputJson || isProcessing}
				className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed mb-6"
			>
				{isProcessing ? "Translating..." : "Translate"}
			</button>

			{outputJson && (
				<div>
					<h2 className="text-xl font-semibold mb-2">4. Output JSON</h2>
					<pre className="bg-gray-100 p-4 rounded overflow-x-auto max-h-96 font-mono">
						{outputJson}
					</pre>
					<button
						onClick={() => {
							const blob = new Blob([outputJson], { type: "application/json" });
							const url = URL.createObjectURL(blob);
							const link = document.createElement("a");
							link.href = url;
							link.download = `${targetLanguage}-translated.json`;
							link.click();
							URL.revokeObjectURL(url);
						}}
						className="bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600"
					>
						Download Translated JSON
					</button>
				</div>
			)}
		</div>
	);
}
