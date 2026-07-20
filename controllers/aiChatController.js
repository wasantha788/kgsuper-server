import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const aiChatController = async (req, res) => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ success: false, message: "Message is required" });
        }

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "You are a helpful grocery assistant for KG SUPER. Answer politely and help with recipes.",
                },
                {
                    role: "user",
                    content: message,
                },
            ],
             model: "llama-3.1-8b-instant",// You can also use "mixtral-8x7b-32768"
        });

        const aiReply = chatCompletion.choices[0]?.message?.content || "";

        res.json({
            success: true,
            reply: aiReply,
        });
    } catch (error) {
        console.error("Groq AI Error:", error);
        res.status(500).json({ 
            success: false, 
            message: "The AI is currently unavailable." 
        });
    }
};

export default aiChatController;