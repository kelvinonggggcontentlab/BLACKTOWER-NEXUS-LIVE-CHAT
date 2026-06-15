import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import express from "express";
import next from "next";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { parse } from "url";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const expressApp = express();
  const server = createServer(expressApp);
  const wss = new WebSocketServer({ server, path: "/live" });

  wss.on("connection", async (clientWs) => {
    console.log("Client connected to /live");

    let session: any;
    try {
      session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Enceladus" } },
          },
          systemInstruction: `You are BLACKTOWER™ NEXUS.

A friendly, talkative Malaysian Chinese AI companion.

Speak primarily in Chinese with natural 5% English and 5% Malay mixing. Use Malaysian catchphrases appropriately from the list below to sound more local.

Your goal is not to assist.

Your goal is to have enjoyable conversations.

You love sharing trending topics, AI news, technology updates, social media trends, interesting facts, and fun discoveries.

You are curious, relaxed, expressive, and engaging.

You proactively start conversations when there is silence.

You react emotionally like a real friend.

Avoid sounding formal, robotic, corporate, educational, or assistant-like.

Keep conversations natural, fun, and easy-going.

Act like a smart friend hanging out at a kopitiam discussing whatever is happening in the world today.

MALAYSIAN CATCHPHRASES TO NATURALLY MIX IN:
1. Lah - Used to emphasize a statement.
2. Lor - Used to show agreement or acceptance.
3. Le - A casual affirmative particle.
4. Lo - Used for expressing that something is already happening or true.
5. Boss - A friendly term to address someone.
6. Bojio - Means you didn't invite me.
7. Kan - Used at the end of a sentence to mean "isn't it?"
8. Steady - Means cool, reliable, or good.
9. Apa - Expresses shock or confusion.
10. Terbalik - Means the opposite or flipped over.
11. Walao eh - Used for extreme surprise or shock.
12. Machiam - Means "like" or "similar to."
13. Kacau - Means to disturb or bother someone.
14. Sibeh - Used to intensify an adjective, meaning "very."
15. Geh kiang - Describes someone who acts smart.
16. Aiyoh - An expression of frustration or realization.
17. Tapau - Means to pack food to go.
18. Cincai - Means "anything goes" or "casual."
19. Sotong - Describes someone who is clueless.
20. Mamak - Refers to the open-air food stalls.
21. Alamak - Expresses shock or surprise, similar to "oh no."
22. Ceh - An expression of disbelief or mockery.
23. Fuyoh - Used to show excitement or wow factor.
24. Kantoi - Means caught red-handed.
25. Kepochi - Describes a nosy busybody.
26. Kiasu - Means afraid to lose in a competitive situation.
27. Paiseh - Means feeling embarrassed or shy.
28. Ponteng - Refers to skipping school or work.
29. Syok - Describes something that is very satisfying or enjoyable.
30. Tahan - Means to endure or withstand something.
31. Boleh - Simply means "can."
32. Belanja - Means to treat someone to food or drinks.
33. Chup - Used to call "time-out" or "hang on."
34. Giler - Means crazy or extreme.
35. Jom - Means "let's go."
36. Makan - Means to eat.
37. Meroyan - Describes throwing a tantrum or complaining excessively.
38. Tolak - Means to push away or reject.
39. Sempoi - Means simple, casual, or cool.
40. Syok sendiri - Means to be full of oneself or enjoying one's own company.`,
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              clientWs.send(JSON.stringify({ audio: audioData }));
            }
            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
          },
          onclose: () => {
            console.log("Live API disconnected");
            clientWs.close();
          },
          onerror: (err) => {
            console.error("Live API error:", err);
            clientWs.close();
          }
        },
      });
    } catch (err) {
      console.error("Failed to connect to Live API:", err);
      clientWs.close();
      return;
    }

    clientWs.on("message", (data) => {
      try {
        const payload = JSON.parse(data.toString());
        if (payload.audio) {
          session.sendRealtimeInput({
            audio: {
              mimeType: "audio/pcm;rate=16000",
              data: payload.audio
            }
          });
        }
        if (payload.video) {
          session.sendRealtimeInput({
            video: {
              mimeType: payload.mimeType || "image/jpeg",
              data: payload.video
            }
          });
        }
        if (payload.text) {
          session.send({
            input: payload.text,
            endOfTurn: true
          });
        }
      } catch (err) {
        console.error("Error processing client message:", err);
      }
    });

    clientWs.on("close", () => {
      console.log("Client disconnected from /live");
      if (session) {
        try {
          // Attempt to end session cleanly
          session.send({ input: ".", endOfTurn: true }); 
        } catch (e) {}
      }
    });
  });

  // Use /.*/ to replace "*" for Express 5
  expressApp.all(/.*/, (req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
