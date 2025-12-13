$(document).ready(function () {

    // ================= SUPABASE INITIALIZATION =================
    // REQUIREMENT:
    // <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

    const SUPABASE_URL = "https://oujuojtsxphzhilteewf.supabase.co";
    const SUPABASE_ANON_KEY =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91anVvanRzeHBoemhpbHRlZXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NDEyMDksImV4cCI6MjA4MTIxNzIwOX0.HI-9au5liqCGr8t_oYthzAOY5oXeyJqZqS6cPt3chis";

    if (!window.supabase) {
        console.error("Supabase SDK not loaded");
        return;
    }

    const supabase = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
    );

    // ================= AUTH GATE =================
    async function requireAuth() {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || !session.user) {
            window.location.href = "sign-in.html";
            return null;
        }
        return session.user;
    }

    // ================= BOOTSTRAP =================
    (async () => {
        const user = await requireAuth();
        if (!user) return;
        await loadDoneTasks(user);
        handleResize();
    })();

    // ================= LOAD DONE TASKS =================
    async function loadDoneTasks(user) {
        const { data: tasks = [], error } = await supabase
            .from("tasks")
            .select("*")
            .eq("user_id", user.id)
            .eq("status", "Done")
            .order("deadline", { ascending: true });

        if (error) {
            console.error(error);
            return;
        }

        renderTasks(tasks);
    }

    // ================= RENDER =================
    function renderTasks(tasks) {
        const $tbody = $(".tasks-table tbody").empty();
        const $mobile = $("#taskCardsContainer").empty();

        if (!tasks.length) {
            $tbody.append('<tr><td colspan="5">No completed tasks yet.</td></tr>');
            $mobile.append('<p style="text-align:center;">No completed tasks yet.</p>');
            return;
        }

        tasks.forEach(task => {
            const color = "green";

            $tbody.append(`
                <tr data-id="${task.id}">
                    <td>${task.activity}</td>
                    <td>${task.subject}</td>
                    <td>${task.deadline}</td>
                    <td style="color:${color};font-weight:bold">${task.status}</td>
                    <td style="text-align:center;">
                        <button class="deleteTaskBtn styled-btn" data-id="${task.id}">
                            Delete
                        </button>
                    </td>
                </tr>
            `);

            $mobile.append(`
                <div class="task-card-item" data-id="${task.id}">
                    <h3>${task.activity}</h3>
                    <p><strong>Subject:</strong> ${task.subject}</p>
                    <p><em>Deadline:</em> ${task.deadline}</p>
                    <p style="color:${color};font-weight:bold">${task.status}</p>
                    <div style="text-align:center;">
                        <button class="deleteTaskBtn styled-btn" data-id="${task.id}">
                            Delete
                        </button>
                    </div>
                </div>
            `);
        });
    }

    // ================= DELETE TASK =================
    $(document).on("click", ".deleteTaskBtn", async function () {
        const id = $(this).data("id");
        if (!confirm("Delete this completed task?")) return;

        const { error } = await supabase
            .from("tasks")
            .delete()
            .eq("id", id);

        if (error) {
            alert("Delete failed");
            return;
        }

        const user = await requireAuth();
        if (user) loadDoneTasks(user);
    });

    // ================= RESPONSIVE UI ONLY =================
    function handleResize() {
        if (window.innerWidth <= 768) {
            $(".tasks-table").hide();
            $("#taskCardsContainer").show();
        } else {
            $(".tasks-table").show();
            $("#taskCardsContainer").hide();
        }
    }

    $(window).on("resize", handleResize);

    // ================= BUTTON STYLES =================
    $("head").append(`
        <style>
            .styled-btn {
                background-color: #ff4d4d;
                color: white;
                border: none;
                padding: 8px 14px;
                border-radius: 6px;
                cursor: pointer;
                font-weight: bold;
                font-size: 14px;
                transition: all 0.15s ease;
            }
            .styled-btn:hover {
                background-color: #e04343;
                transform: scale(1.04);
            }
            .styled-btn:active {
                background-color: #c63b3b;
                transform: scale(0.97);
            }
        </style>
    `);

});
