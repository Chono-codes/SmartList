$(document).ready(function () {
    // ======== SUPABASE INITIALIZATION ========
    const SUPABASE_URL = "https://ulwadkwxicezcssoqcsp.supabase.co";
    const SUPABASE_ANON_KEY = "sb_publishable_l3hp97RkICNbA3tJv1cpKQ_3I7B416S";
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // ======== AUTH CHECK ========
    (async function checkAuth() {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
            window.location.href = "sign-in.html";
        } else {
            loadTasks();
        }
    })();

    // ======== LOAD ONLY DONE TASKS ========
    async function loadTasks() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // ✅ Only fetch completed (Done) tasks
        const { data: tasks, error } = await supabase
            .from("tasks")
            .select("*")
            .eq("user_id", user.id)
            .eq("status", "Done")
            .order("deadline", { ascending: true });

        if (error) {
            console.error(error);
            return;
        }

        const $tbody = $(".tasks-table tbody");
        const $mobileContainer = $("#taskCardsContainer");
        $tbody.empty();
        $mobileContainer.empty();

        if (!tasks.length) {
            $tbody.append('<tr><td colspan="5">No completed tasks yet.</td></tr>');
            $mobileContainer.html('<p style="text-align:center;">No completed tasks yet.</p>');
            return;
        }

        tasks.forEach(task => {
            const statusColor = "green";

            // Desktop Table Row
            $tbody.append(`
                <tr>
                    <td>${task.activity}</td>
                    <td>${task.subject}</td>
                    <td>${task.deadline}</td>
                    <td style="color:${statusColor}; font-weight:bold;">${task.status}</td>
                    <td style="text-align:center;">
                        <button class="deleteTaskBtn styled-btn" data-id="${task.id}">Delete</button>
                    </td>
                </tr>
            `);

            // Mobile Card View
            $mobileContainer.append(`
                <div class="task-card-item" data-id="${task.id}">
                    <h3>${task.activity}</h3>
                    <p><strong>Subject:</strong> ${task.subject}</p>
                    <p><em>Deadline:</em> ${task.deadline}</p>
                    <p><em>Status:</em> <span style="color:${statusColor}; font-weight:bold;">${task.status}</span></p>
                    <div class="card-buttons" style="text-align:center;">
                        <button class="deleteTaskBtn styled-btn" data-id="${task.id}">Delete</button>
                    </div>
                </div>
            `);
        });

        // ======== Delete Task Handler ========
        $(".deleteTaskBtn").off("click").on("click", async function () {
            const id = $(this).data("id");
            if (!confirm("Delete this completed task?")) return;
            await supabase.from("tasks").delete().eq("id", id);
            loadTasks();
        });
    }

    // ======== BUTTON STYLES (inline for simplicity) ========
    const style = `
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
          transition: all 0.2s ease-in-out;
        }
        .styled-btn:hover {
          background-color: #e04343;
          transform: scale(1.05);
        }
        .styled-btn:active {
          background-color: #c63b3b;
          transform: scale(0.97);
        }
      </style>
    `;
    $("head").append(style);
});

