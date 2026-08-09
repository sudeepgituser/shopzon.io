import os
import json
import requests
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from products.models import Product

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/interactions"

# Tried in order. Each Gemini model has its OWN separate free-tier quota,
# so if the first one is exhausted (429), we automatically fall back to
# the next instead of failing the whole chat feature.
MODEL_FALLBACK_CHAIN = ["gemini-flash-lite-latest", "gemini-pro-latest", "gemini-3.5-flash-lite", "gemini-3.5-flash"]

VALID_CATEGORIES = ["toys", "lamp", "clothes", "beauty", "lights", "games", "electronics"]

SYSTEM_INSTRUCTION = (
    "You are a friendly shopping assistant for Shopzon, an online store. "
    "You handle two kinds of requests: normal support conversation "
    "(orders, shipping, returns), and product search/recommendations.\n\n"
    "You must respond with ONLY a single JSON object, no other text, no "
    "markdown code fences, in exactly this shape:\n"
    "{\"reply\": \"<your natural language reply>\", \"search\": null}\n\n"
    "If the customer is browsing, asking for recommendations, or "
    "mentioning a product category, item type, or price range, instead "
    "set search to an object:\n"
    "{\"reply\": \"<a short natural sentence introducing the results>\", "
    "\"search\": {\"keywords\": \"<key words or empty string>\", "
    "\"category\": \"<one of: toys, lamp, clothes, beauty, lights, games, "
    "electronics, or null>\", \"max_price\": <number or null>}}\n\n"
    "Only use a category from that exact list, or null if nothing matches "
    "-- rely on keywords instead in that case. Never include text outside "
    "the JSON object."
)


class ChatView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        user_message = request.data.get("message", "").strip()
        if not user_message:
            return Response({"error": "No message provided."}, status=400)

        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return Response(
                {"error": "Server is missing GEMINI_API_KEY. Ask the site owner to configure it."},
                status=500,
            )

        raw_text, error_detail = call_gemini_with_fallback(user_message, api_key)

        if raw_text is None:
            return Response(
                {"error": "AI service error: " + error_detail},
                status=502,
            )

        reply_text, search_filters = parse_ai_response(raw_text)
        products = []

        if search_filters:
            products = find_matching_products(search_filters)

        return Response({"reply": reply_text, "products": products})


def call_gemini_with_fallback(user_message, api_key):
    # Tries each model in MODEL_FALLBACK_CHAIN in order. Returns
    # (raw_text, None) on success, or (None, last_error_message) if every
    # model in the chain failed.
    last_error = "Unknown error."

    for model_name in MODEL_FALLBACK_CHAIN:
        try:
            gemini_response = requests.post(
                GEMINI_URL,
                headers={
                    "Content-Type": "application/json",
                    "x-goog-api-key": api_key,
                },
                json={
                    "model": model_name,
                    "input": user_message,
                    "system_instruction": SYSTEM_INSTRUCTION,
                    "generation_config": {
                        "thinking_level": "minimal"
                    },
                },
                timeout=45,
            )
        except requests.exceptions.RequestException as e:
            last_error = "Could not reach the AI service: " + str(e)
            continue

        if gemini_response.status_code == 429:
            # This model's quota is exhausted -- try the next one in the
            # chain instead of giving up immediately.
            last_error = gemini_response.text[:200]
            continue

        if not gemini_response.ok:
            last_error = gemini_response.text[:200]
            continue

        data = gemini_response.json()
        raw_text = extract_reply_text(data)
        if raw_text:
            return raw_text, None
        last_error = "Empty response from model " + model_name

    return None, last_error


def extract_reply_text(data):
    for step in data.get("steps", []):
        if step.get("type") == "model_output":
            for content_block in step.get("content", []):
                if content_block.get("type") == "text":
                    return content_block.get("text", "")
    return ""


def parse_ai_response(raw_text):
    try:
        parsed = json.loads(raw_text)
        reply = parsed.get("reply", "").strip()
        search = parsed.get("search")
        if not reply:
            reply = "Sorry, I could not generate a response."
        return reply, search
    except (json.JSONDecodeError, AttributeError):
        return (raw_text or "Sorry, I could not generate a response."), None


def find_matching_products(search_filters):
    queryset = Product.objects.all()

    category = search_filters.get("category")
    if category in VALID_CATEGORIES:
        queryset = queryset.filter(category=category)

    max_price = search_filters.get("max_price")
    if max_price:
        try:
            queryset = queryset.filter(price__lte=float(max_price))
        except (TypeError, ValueError):
            pass

    keywords = (search_filters.get("keywords") or "").strip()
    if keywords:
        queryset = queryset.filter(title__icontains=keywords)

    results = []
    for product in queryset[:6]:
        results.append({
            "id": product.id,
            "title": product.title,
            "price": str(product.price),
            "image": product.image,
        })
    return results