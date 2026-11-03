"""
서버 메모리 세션

Flask 기본 세션은 쿠키에 저장되어 약 4KB 제한이 있고, 서버를 껐다 켜도 남아 있다.
이 게임은 "앱을 껐다 켜면 마지막 턴 시작 지점으로 돌아간다"가 규칙이므로
진행 상태를 서버 메모리에만 두고, 쿠키에는 세션 번호만 저장한다.
"""

import secrets

from flask.sessions import SessionInterface, SessionMixin
from werkzeug.datastructures import CallbackDict


class MemorySession(CallbackDict, SessionMixin):
    def __init__(self, initial=None, sid=None):
        def on_update(_):
            self.modified = True
        super().__init__(initial, on_update)
        self.sid = sid
        self.modified = False


class MemorySessionInterface(SessionInterface):
    """세션 내용을 프로세스 메모리에 보관한다."""

    def __init__(self):
        self.store = {}

    def open_session(self, app, request):
        sid = request.cookies.get(self.get_cookie_name(app))
        if sid and sid in self.store:
            return MemorySession(self.store[sid], sid=sid)
        return MemorySession(sid=secrets.token_hex(16))

    def save_session(self, app, session, response):
        self.store[session.sid] = dict(session)
        response.set_cookie(
            self.get_cookie_name(app), session.sid, httponly=True, samesite="Lax",
            path=self.get_cookie_path(app),
        )
