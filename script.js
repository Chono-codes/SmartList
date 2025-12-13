$(document).ready(function () {

    // ================= SUPABASE INITIALIZATION =================
    // REQUIREMENT: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

    const SUPABASE_URL = "https://oujuojtsxphzhilteewf.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91anVvanRzeHBoemhpbHRlZXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NDEyMDksImV4cCI6MjA4MTIxNzIwOX0.HI-9au5liqCGr8t_oYthzAOY5oXeyJqZqS6cPt3chis";

    if (!window.supabase) {
        console.error('Supabase SDK not loaded');
        return;
    }

    const supabase = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
    );

    // ================= AUTH GATE (SAFE) =================
    // Use getSession ONLY. No refreshSession. No getUser race.

    async function requireAuth() {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || !session.user) {
            window.location.href = 'sign-in.html';
            return null;
        }
        return session.user;
    }

    // ================= PAGE BOOTSTRAP =================

    (async () => {
        const user = await requireAuth();
        if (!user) return;
        await loadTasks(user);
        await loadProfile(user);
    })();

    // ================= LOGOUT =================

    $(document).on('click', '#logoutBtn', async function () {
        const { error } = await supabase.auth.signOut();
        if (error) {
            alert('Logout failed');
            return;
        }
        window.location.href = 'sign-in.html';
    });

    // ================= PROFILE =================

    async function loadProfile(user) {
        const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

        const displayName = profile?.full_name || user.email;
        const profilePic = profile?.profile_pic || getGravatarUrl(user.email);

        $('#userName').html(`<strong>${displayName}</strong>`);
        $('#profilePic').attr('src', profilePic);
    }

    function getGravatarUrl(email) {
        const hash = CryptoJS.MD5(email.trim().toLowerCase()).toString();
        return `https://www.gravatar.com/avatar/${hash}?d=mp&s=200`;
    }

    // ================= PROFILE PIC UPLOAD =================

    $(document).on('click', '#changePicBtn', () => $('#uploadProfilePic').click());

    $(document).on('change', '#uploadProfilePic', async function (e) {
        const file = e.target.files[0];
        if (!file) return;

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return alert('Not logged in');

        const user = session.user;
        const ext = file.name.split('.').pop();
        const path = `avatars/${user.id}-${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
            .from('profile_pics')
            .upload(path, file, { upsert: true });

        if (uploadError) return alert('Upload failed');

        const { data } = supabase
            .storage
            .from('profile_pics')
            .getPublicUrl(path);

        await supabase
            .from('users')
            .update({ profile_pic: data.publicUrl })
            .eq('id', user.id);

        $('#profilePic').attr('src', data.publicUrl);
    });

    // ================= TASKS =================

    async function loadTasks(user) {
        const { data: tasks = [], error } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', user.id)
            .order('deadline');

        if (error) return console.error(error);

        renderTasks(tasks);
    }

    function renderTasks(tasks) {
        const $tbody = $('.tasks-table tbody').empty();
        const $mobile = $('#taskCardsContainer').empty();

        const visible = tasks.filter(t => (t.status || '').toLowerCase() !== 'done');
        const done = tasks.filter(t => (t.status || '').toLowerCase() === 'done').length;
        const ongoing = tasks.filter(t => (t.status || '').toLowerCase() === 'ongoing').length;

        $('#tasksDone').text(done);
        $('#tasksOngoing').text(ongoing);

        if (!visible.length) {
            $tbody.append('<tr><td colspan="5">No tasks found.</td></tr>');
            $mobile.append('<p style="text-align:center;">No tasks found.</p>');
            return;
        }

        const today = new Date().toISOString().split('T')[0];

        visible.forEach(task => {
            const color = task.deadline < today ? 'red' : 'orange';

            $tbody.append(`
                <tr data-id="${task.id}">
                    <td>${task.activity}</td>
                    <td>${task.subject}</td>
                    <td>${task.deadline}</td>
                    <td style="color:${color};font-weight:bold">${task.status}</td>
                    <td>
                        <button class="doneTaskBtn" data-id="${task.id}">Done</button>
                        <button class="deleteTaskBtn" data-id="${task.id}">Delete</button>
                    </td>
                </tr>`);

            $mobile.append(`
                <div class="task-card-item" data-id="${task.id}">
                    <h3>${task.activity}</h3>
                    <p><strong>Subject:</strong> ${task.subject}</p>
                    <p><em>Deadline:</em> ${task.deadline}</p>
                    <p style="color:${color}">${task.status}</p>
                    <button class="doneTaskBtn" data-id="${task.id}">Done</button>
                    <button class="deleteTaskBtn" data-id="${task.id}">Delete</button>
                </div>`);
        });
    }

    // ================= TASK ACTIONS =================

    $(document).on('click', '.doneTaskBtn', async function () {
        const id = $(this).data('id');
        await supabase.from('tasks').update({ status: 'Done' }).eq('id', id);
        const user = await requireAuth();
        if (user) loadTasks(user);
    });

    $(document).on('click', '.deleteTaskBtn', async function () {
        const id = $(this).data('id');
        if (!confirm('Delete task?')) return;
        await supabase.from('tasks').delete().eq('id', id);
        const user = await requireAuth();
        if (user) loadTasks(user);
    });

    // ================= RESPONSIVE UI (NO DATA FETCH) =================

    function handleResize() {
        if (window.innerWidth <= 768) {
            $('.tasks-table').hide();
            $('#taskCardsContainer').show();
        } else {
            $('.tasks-table').show();
            $('#taskCardsContainer').hide();
        }
    }

    handleResize();
    $(window).on('resize', handleResize);
});
