export async function handleLogout(): Promise<Response> {
	return Response.json({ ok: true }, { status: 200 });
}
