import { NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";

export async function GET() {
  try {
    console.log("🧪 Testing Mercado Pago configuration...");

    // Verificar token
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!token) {
      return NextResponse.json({
        error: "MERCADOPAGO_ACCESS_TOKEN not configured",
        configured: false,
      });
    }

    console.log("✅ Token configured, length:", token.length);

    // Verificar si es token de test o producción
    // Los tokens nuevos de MP ya no empiezan con TEST-, usar NODE_ENV para determinar
    const isTestToken = process.env.NODE_ENV !== "production";
    console.log("🔍 Token type:", isTestToken ? "TEST" : "PRODUCTION");
    console.log("🌍 Environment:", process.env.NODE_ENV);

    // Intentar crear una preferencia de prueba
    const client = new MercadoPagoConfig({
      accessToken: token,
      options: { timeout: 5000 },
    });

    const preference = new Preference(client);

    const testPreferenceData = {
      items: [
        {
          id: "test-item",
          title: "Test Item - 1 crédito",
          description: "Item de prueba para verificar configuración",
          quantity: 1,
          unit_price: 1,
          currency_id: "MXN",
        },
      ],
      external_reference: "test-preference",
    };

    console.log("🔄 Creating test preference...");
    const mpPreference = await preference.create({ body: testPreferenceData });
    console.log("✅ Test preference created successfully");

    return NextResponse.json({
      configured: true,
      token_type: isTestToken ? "TEST" : "PRODUCTION",
      environment: process.env.NODE_ENV,
      preference_id: mpPreference.id,
      init_point: mpPreference.init_point,
      sandbox_init_point: mpPreference.sandbox_init_point,
      test_successful: true,
    });
  } catch (error: any) {
    console.error("❌ Mercado Pago test failed:", error);

    return NextResponse.json(
      {
        configured: false,
        error: error.message || "Unknown error",
        details: error.response?.data || null,
        test_successful: false,
      },
      { status: 500 }
    );
  }
}
