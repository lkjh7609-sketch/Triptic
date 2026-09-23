import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
let supabase = null;
if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const city = req.query.city;
    if (!city) return res.status(400).json({ error: 'City is required' });

    // 1. Check cache
    if (supabase) {
        try {
            const { data: cacheHit } = await supabase
                .from('ai_recommendation_cache')
                .select('recommendations')
                .eq('city', city)
                .eq('category', 'city_desc')
                .single();
            
            if (cacheHit && cacheHit.recommendations?.description) {
                return res.status(200).json({
                    success: true,
                    description: cacheHit.recommendations.description,
                    cached: true
                });
            }
        } catch (e) {
            console.warn('[Cache] 읽기 실패:', e.message);
        }
    }

    // 2. Fetch from DeepSeek
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterApiKey) {
        return res.status(500).json({ error: 'Missing OPENROUTER_API_KEY' });
    }

    const prompt = `여행자를 위해 '${city}'에 대한 매력적이고 유용한 소개를 300자 내외로 작성해주세요. 도시의 분위기, 대표적인 특징, 여행 포인트가 잘 드러나야 합니다.`;

    try {
        const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openRouterApiKey}`,
                'HTTP-Referer': 'https://triptic.com',
                'X-Title': 'Triptic'
            },
            body: JSON.stringify({
                model: 'deepseek/deepseek-chat',
                messages: [
                    { role: 'system', content: 'You are an expert travel copywriter.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7
            })
        });

        const aiData = await aiRes.json();
        const description = aiData.choices?.[0]?.message?.content?.trim();

        if (description) {
            // 3. Save to cache
            if (supabase) {
                try {
                    await supabase.from('ai_recommendation_cache').insert({
                        city,
                        place_name: city,
                        category: 'city_desc',
                        recommendations: { description },
                        provider: 'OpenRouter-DeepSeek',
                        model_used: 'deepseek-chat',
                        hit_count: 1
                    });
                } catch (e) {
                    console.warn('[Cache] 저장 실패:', e.message);
                }
            }

            return res.status(200).json({
                success: true,
                description,
                cached: false
            });
        } else {
            return res.status(500).json({ error: 'Failed to generate description' });
        }
    } catch (error) {
        console.error('DeepSeek call failed:', error);
        return res.status(500).json({ error: 'AI Error' });
    }
}
