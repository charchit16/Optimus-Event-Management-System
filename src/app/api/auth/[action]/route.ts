import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  const { action } = await params;
  const db = await getDb();
  const usersColl = db.collection<any>("users");
  const profilesColl = db.collection<any>("profiles");

  try {
    const body = await request.json().catch(() => ({}));

    if (action === "signin" || action === "login") {
      const { email, password } = body;
      if (!email || !password) {
        return NextResponse.json({ error: { message: "Email and password are required" } }, { status: 400 });
      }

      // Check users collection
      let user = await usersColl.findOne({ email });

      // If database is empty or user is one of the defaults, support automatic authentication
      if (!user) {
        if (email === "admin@optimus.com" && password === "admin123") {
          user = {
            id: "u_admin_001",
            uuid: "u_admin_001",
            email: "admin@optimus.com",
            name: "System Admin",
            role: "admin",
            created_at: new Date().toISOString(),
          };
          await usersColl.insertOne({ ...user, password: "admin123" });
        } else if (email === "organizer@optimus.com" && password === "organizer123") {
          user = {
            id: "u_org_001",
            uuid: "u_org_001",
            email: "organizer@optimus.com",
            name: "Alex Rivera",
            role: "organizer",
            created_at: new Date().toISOString(),
          };
          await usersColl.insertOne({ ...user, password: "organizer123" });
        } else if ((email === "user@optimus.com" || email === "aerospacebombay1@gmail.com") && password === "user123") {
          user = {
            id: "u_user_001",
            uuid: "u_user_001",
            email: email,
            name: "Archit Singh",
            full_name: "Archit Singh",
            role: "user",
            created_at: new Date().toISOString(),
          };
          await usersColl.insertOne({ ...user, password: "user123" });
        } else {
          return NextResponse.json({ error: { message: "Invalid email or password" } }, { status: 401 });
        }
      } else if (user.password && user.password !== password) {
        return NextResponse.json({ error: { message: "Invalid email or password" } }, { status: 401 });
      }

      // Ensure profile exists in MongoDB
      let profile = await profilesColl.findOne({ email });
      if (!profile) {
        profile = {
          id: user.id || user.uuid || user._id?.toString(),
          uuid: user.id || user.uuid || user._id?.toString(),
          email: user.email,
          name: user.name || user.full_name || user.email.split("@")[0],
          full_name: user.full_name || user.name || user.email.split("@")[0],
          role_type: user.role || "user",
          created_at: new Date().toISOString(),
        };
        await profilesColl.insertOne(profile);
      }

      const sessionUser = {
        id: user.id || user.uuid || user._id?.toString(),
        email: user.email,
        role: user.role || profile.role_type || "user",
        user_metadata: {
          name: user.name || profile.name || profile.full_name,
          full_name: user.full_name || profile.full_name,
        },
      };

      const session = {
        access_token: "mock_jwt_" + Date.now(),
        token_type: "bearer",
        user: sessionUser,
      };

      return NextResponse.json({ data: { user: sessionUser, session }, error: null });
    }

    if (action === "signup") {
      const { email, password, options = {} } = body;
      if (!email || !password) {
        return NextResponse.json({ error: { message: "Email and password are required" } }, { status: 400 });
      }

      const existing = await usersColl.findOne({ email });
      if (existing) {
        return NextResponse.json({ error: { message: "User with this email already exists" } }, { status: 400 });
      }

      const userId = "u_" + Math.random().toString(36).substring(2, 10);
      const fullName = options.data?.full_name || email.split("@")[0];
      const assignedRole = (email.toLowerCase() === "charchitas8188@gmail.com" || email.toLowerCase() === "admin@optimus.com") ? "admin" : "user";

      const newUser = {
        id: userId,
        uuid: userId,
        email,
        password,
        name: fullName,
        full_name: fullName,
        role: assignedRole,
        created_at: new Date().toISOString(),
      };

      await usersColl.insertOne(newUser);

      // Create matching profile
      const newProfile = {
        id: userId,
        uuid: userId,
        email,
        name: fullName,
        full_name: fullName,
        role_type: assignedRole,
        created_at: new Date().toISOString(),
      };
      await profilesColl.insertOne(newProfile);

      const sessionUser = {
        id: userId,
        email,
        role: assignedRole,
        user_metadata: {
          name: fullName,
          full_name: fullName,
        },
      };

      const session = {
        access_token: "mock_jwt_" + Date.now(),
        token_type: "bearer",
        user: sessionUser,
      };

      return NextResponse.json({ data: { user: sessionUser, session }, error: null });
    }

    if (action === "oauth-google") {
      const email = (body.email || "aerospacebombay1@gmail.com").trim().toLowerCase();
      let user = await usersColl.findOne({
        $or: [
          { email },
          { email: { $regex: new RegExp(`^${email}$`, "i") } }
        ]
      });

      if (!user) {
        // If u_user_001 exists and had old email, link or update it
        const u001 = await usersColl.findOne({ id: "u_user_001" });
        if (u001 && (u001.email === "user@optimus.com" || email === "aerospacebombay1@gmail.com")) {
          user = u001;
          await usersColl.updateOne({ id: "u_user_001" }, { $set: { email, name: body.name || "Archit Singh", full_name: body.name || "Archit Singh" } });
          await profilesColl.updateOne({ id: "u_user_001" }, { $set: { email, name: body.name || "Archit Singh", full_name: body.name || "Archit Singh" } });
        } else {
          const userId = "u_" + Math.random().toString(36).substring(2, 10);
          const name = body.name || (email.startsWith("aerospace") ? "Archit Singh" : email.split("@")[0].replace(/[._-]/g, " "));
          user = {
            id: userId,
            uuid: userId,
            email,
            password: "oauth_user",
            name,
            full_name: name,
            role: (email === "charchitas8188@gmail.com" || email === "admin@optimus.com") ? "admin" : "user",
            created_at: new Date().toISOString(),
          };
          await usersColl.insertOne(user);
        }
      }

      let profile = await profilesColl.findOne({
        $or: [{ uuid: user.id }, { id: user.id }, { email: user.email }]
      });

      if (!profile) {
        profile = {
          id: user.id || user.uuid,
          uuid: user.id || user.uuid,
          email: user.email,
          name: user.name || user.full_name,
          full_name: user.full_name || user.name,
          role_type: user.role || "user",
          avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.name || "User")}`,
          created_at: new Date().toISOString(),
        };
        await profilesColl.insertOne(profile);
      }

      const sessionUser = {
        id: user.id || user.uuid,
        email: user.email,
        role: user.role || profile.role_type || "user",
        user_metadata: {
          name: profile.name || user.name,
          full_name: profile.full_name || user.full_name || profile.name,
          avatar_url: profile.avatar_url,
        },
      };

      const session = {
        access_token: "mock_jwt_" + Date.now(),
        token_type: "bearer",
        user: sessionUser,
      };

      return NextResponse.json({ data: { user: sessionUser, session }, error: null });
    }

    if (action === "update-profile") {
      const { id, name, full_name, email, phone_number, avatar_url } = body;
      const targetId = id;
      if (!targetId) {
        return NextResponse.json({ error: { message: "User ID is required" } }, { status: 400 });
      }

      const resolvedName = name || full_name;
      const updateData: any = {};
      if (resolvedName) {
        updateData.name = resolvedName;
        updateData.full_name = resolvedName;
      }
      if (email) updateData.email = email;
      if (phone_number !== undefined) updateData.phone_number = phone_number;
      if (avatar_url) updateData.avatar_url = avatar_url;

      // Update profiles
      await profilesColl.updateOne(
        { $or: [{ uuid: targetId }, { id: targetId }] },
        { $set: updateData }
      );

      // Update users
      const userUpdateData: any = {};
      if (resolvedName) {
        userUpdateData.name = resolvedName;
        userUpdateData.full_name = resolvedName;
      }
      if (email) userUpdateData.email = email;

      if (Object.keys(userUpdateData).length > 0) {
        await usersColl.updateOne(
          { $or: [{ uuid: targetId }, { id: targetId }] },
          { $set: userUpdateData }
        );
      }

      return NextResponse.json({ data: { success: true }, error: null });
    }

    if (action === "update-user") {
      const { password, id } = body;
      if (id && password) {
        await usersColl.updateOne({ $or: [{ id }, { uuid: id }] }, { $set: { password } });
      }
      return NextResponse.json({ data: { success: true }, error: null });
    }

    return NextResponse.json({ error: { message: "Unknown action" } }, { status: 404 });
  } catch (err: any) {
    console.error("Auth API Error:", err);
    return NextResponse.json({ error: { message: err.message } }, { status: 500 });
  }
}
